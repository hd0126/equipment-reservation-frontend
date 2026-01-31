// Admin page functions

// Load dashboard stats
const loadDashboardStats = async () => {
  try {
    const [equipment, reservations] = await Promise.all([
      getEquipment(),
      getReservations()
    ]);

    const now = new Date();
    const activeReservations = reservations.filter(r =>
      new Date(r.end_time) >= now && r.status === 'confirmed'
    );

    const todayReservations = reservations.filter(r => {
      const start = new Date(r.start_time);
      return start.toDateString() === now.toDateString();
    });

    document.getElementById('totalEquipment').textContent = equipment.length;
    document.getElementById('availableEquipment').textContent =
      equipment.filter(e => e.status === 'available').length;
    document.getElementById('totalReservations').textContent = reservations.length;
    document.getElementById('activeReservations').textContent = activeReservations.length;
    document.getElementById('todayReservations').textContent = todayReservations.length;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
};

// Cached stats data for Excel export
let lastStatsData = null;

// Load detailed statistics with optional date range
const loadStatistics = async (startDate, endDate) => {
  try {
    let url = '/stats';
    if (startDate && endDate) {
      url += `?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    const stats = await apiRequest(url);
    lastStatsData = stats;

    // Render equipment stats (with hours)
    const equipmentTable = document.getElementById('equipmentStatsTable');
    if (equipmentTable) {
      if (stats.equipmentStats && stats.equipmentStats.length > 0) {
        equipmentTable.innerHTML = stats.equipmentStats.map(eq => {
          const hours = parseFloat(eq.total_hours || 0).toFixed(1);
          return `
          <tr>
            <td>${eq.equipment_name}</td>
            <td class="text-center"><span class="badge bg-primary">${eq.total_reservations || 0}</span></td>
            <td class="text-center"><span class="badge bg-success">${eq.confirmed_count || 0}</span></td>
            <td class="text-center"><span class="badge bg-info">${hours}h</span></td>
          </tr>
        `}).join('');
      } else {
        equipmentTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">예약 데이터 없음</td></tr>';
      }
    }

    // Render user stats (with hours)
    const userTable = document.getElementById('userStatsTable');
    if (userTable) {
      if (stats.userStats && stats.userStats.length > 0) {
        userTable.innerHTML = stats.userStats.map(user => {
          const hours = parseFloat(user.total_hours || 0).toFixed(1);
          return `
          <tr>
            <td>${user.username} <small class="text-muted">(${user.email})</small></td>
            <td class="text-center"><span class="badge bg-primary">${user.total_reservations || 0}</span></td>
            <td class="text-center"><span class="badge bg-success">${user.confirmed_count || 0}</span></td>
            <td class="text-center"><span class="badge bg-info">${hours}h</span></td>
          </tr>
        `}).join('');
      } else {
        userTable.innerHTML = '<tr><td colspan="4" class="text-center text-muted">예약 데이터 없음</td></tr>';
      }
    }
  } catch (error) {
    console.error('Failed to load statistics:', error);
    const eqTable = document.getElementById('equipmentStatsTable');
    if (eqTable) eqTable.innerHTML = `<tr><td colspan="4" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
    const uTable = document.getElementById('userStatsTable');
    if (uTable) uTable.innerHTML = `<tr><td colspan="4" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
  }
};

// Load equipment management
const loadEquipmentManagement = async () => {
  const container = document.getElementById('equipmentManagementTable');
  showLoading(container);

  try {
    const [equipment, permissionData] = await Promise.all([
      getEquipment(),
      apiRequest('/permissions/summary').catch(() => ({ equipmentSummary: [] }))
    ]);

    // Create permission count map
    const permissionCountMap = {};
    if (permissionData.equipmentSummary) {
      permissionData.equipmentSummary.forEach(e => {
        permissionCountMap[e.id] = e.permission_count;
      });
    }

    if (equipment.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">등록된 장비가 없습니다</td>
        </tr>
      `;
    } else {
      container.innerHTML = equipment.map(e => {
        const statusClass = e.status === 'available' ? 'status-available' : 'status-maintenance';
        const statusText = e.status === 'available' ? '사용 가능' : '점검 중';
        const permCount = permissionCountMap[e.id] || 0;

        return `
          <tr>
            <td>${e.id}</td>
            <td><strong>${e.name}</strong></td>
            <td>${e.location || '-'}</td>
            <td>
              ${e.manager_name ? `<span class="badge bg-info">${e.manager_name}</span>` : '<span class="text-muted">-</span>'}
              <button class="btn btn-sm btn-outline-secondary ms-1" onclick="openManagerModal(${e.id}, '${e.name}')" title="담당자 지정">
                <i class="bi bi-person-gear"></i>
              </button>
            </td>
            <td>
              <span class="badge bg-primary" onclick="openPermissionModal(${e.id}, '${e.name}')" style="cursor:pointer;" title="권한 관리">
                ${permCount}명
              </span>
            </td>
            <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
            <td>
              <button class="btn btn-sm btn-outline-primary" onclick="editEquipment(${e.id})" title="수정">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-success" onclick="openPermissionModal(${e.id}, '${e.name}')" title="권한 관리">
                <i class="bi bi-person-check"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="handleDeleteEquipment(${e.id})" title="삭제">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger">장비 목록 로드 실패: ${error.message}</td>
      </tr>
    `;
  }
};


// Load reservation management
const loadReservationManagement = async () => {
  const container = document.getElementById('reservationManagementTable');
  showLoading(container);

  try {
    const reservations = await getReservations();

    // Sort by start time descending
    reservations.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

    if (reservations.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted">예약 내역이 없습니다</td>
        </tr>
      `;
    } else {
      container.innerHTML = reservations.slice(0, 20).map(r => {
        const statusClass = `status-${r.status}`;
        const statusText = {
          'confirmed': '확정',
          'pending': '대기',
          'cancelled': '취소됨'
        }[r.status];

        return `
          <tr>
            <td>${r.id}</td>
            <td>${r.equipment_name}</td>
            <td>${r.username}</td>
            <td><small>${formatDate(r.start_time)}</small></td>
            <td><small>${formatDate(r.end_time)}</small></td>
            <td><span class="equipment-status ${statusClass}">${statusText}</span></td>
            <td>
              ${r.status === 'cancelled' ? `
                <button class="btn btn-sm btn-outline-success" onclick="handleRestoreReservation(${r.id})" title="복구">
                  <i class="bi bi-arrow-counterclockwise"></i>
                </button>
              ` : `
                <button class="btn btn-sm btn-outline-danger" onclick="handleAdminCancelReservation(${r.id})" title="취소">
                  <i class="bi bi-x-circle"></i>
                </button>
              `}
              <button class="btn btn-sm btn-outline-danger" onclick="handleAdminDeleteReservation(${r.id})" title="삭제">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    container.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-danger">예약 목록 로드 실패: ${error.message}</td>
      </tr>
    `;
  }
};

// Open add equipment modal
const openAddEquipmentModal = () => {
  document.getElementById('equipmentForm').reset();
  document.getElementById('equipmentId').value = '';
  document.getElementById('equipmentModalLabel').textContent = '새 장비 추가';

  // 이미지 미리보기 초기화
  const previewContainer = document.getElementById('imagePreviewContainer');
  if (previewContainer) previewContainer.style.display = 'none';

  // 문서 버튼 초기화
  ['currentBrochure', 'currentManual', 'currentQuickGuide'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
  modal.show();
};

// Edit equipment
window.editEquipment = async (id) => {
  try {
    const equipment = await getEquipmentById(id);

    document.getElementById('equipmentId').value = equipment.id;
    document.getElementById('equipmentName').value = equipment.name;
    document.getElementById('equipmentDescription').value = equipment.description || '';
    document.getElementById('equipmentLocation').value = equipment.location || '';
    document.getElementById('equipmentStatus').value = equipment.status;

    // 이미지 URL 필드: image_file_url이 있으면 비움 (파일 업로드 이미지가 있으므로)
    const imageFileUrl = equipment.image_file_url;
    document.getElementById('equipmentImageUrl').value = imageFileUrl ? '' : (equipment.image_url || '');

    // 이미지 미리보기: image_file_url 우선, 없으면 image_url 사용
    const previewContainer = document.getElementById('imagePreviewContainer');
    const previewImg = document.getElementById('imagePreview');
    const displayImage = imageFileUrl || equipment.image_url;

    if (displayImage && previewContainer && previewImg) {
      previewImg.src = displayImage;
      previewContainer.style.display = 'block';
      previewImg.onerror = () => {
        previewContainer.style.display = 'none';
      };
    } else if (previewContainer) {
      previewContainer.style.display = 'none';
    }

    // 문서 조회/삭제 버튼 렌더링 함수
    const renderDocButtons = (url, docType, equipId) => {
      if (!url) return '';
      return `
        <a href="${url}" target="_blank" class="btn btn-sm btn-outline-primary py-0 px-1" title="조회">
          <i class="bi bi-eye"></i>
        </a>
        <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1 ms-1" 
                onclick="handleDeleteDocument(${equipId}, '${docType}', '${url}')" title="삭제">
          <i class="bi bi-trash"></i>
        </button>
      `;
    };

    // 현재 문서 파일 표시
    const currentBrochure = document.getElementById('currentBrochure');
    const currentManual = document.getElementById('currentManual');
    const currentQuickGuide = document.getElementById('currentQuickGuide');
    const currentImageFile = document.getElementById('currentImageFile');

    if (currentBrochure) {
      currentBrochure.innerHTML = renderDocButtons(equipment.brochure_url, 'brochure', equipment.id);
    }
    if (currentManual) {
      currentManual.innerHTML = renderDocButtons(equipment.manual_url, 'manual', equipment.id);
    }
    if (currentQuickGuide) {
      currentQuickGuide.innerHTML = renderDocButtons(equipment.quick_guide_url, 'quick_guide', equipment.id);
    }
    // 이미지 조회/삭제 버튼 (image_file_url이 있을 때만)
    if (currentImageFile) {
      currentImageFile.innerHTML = imageFileUrl ? renderDocButtons(imageFileUrl, 'image', equipment.id) : '';
    }

    document.getElementById('equipmentModalLabel').textContent = '장비 수정';

    const modal = new bootstrap.Modal(document.getElementById('equipmentModal'));
    modal.show();
  } catch (error) {
    alert('장비 정보를 불러오는데 실패했습니다: ' + error.message);
  }
};

// 파일을 Base64로 변환
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
};

// 파일 크기 검증 (20MB 제한)
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const validateFileSize = (file) => {
  if (file.size > MAX_FILE_SIZE) {
    alert(`파일 크기가 너무 큽니다.\n\n선택한 파일: ${(file.size / 1024 / 1024).toFixed(2)}MB\n최대 허용: 20MB\n\n더 작은 파일을 선택해주세요.`);
    return false;
  }
  return true;
};

// 문서 파일 업로드
const uploadDocument = async (file, type, equipmentId) => {
  if (!validateFileSize(file)) {
    throw new Error('파일 크기 초과');
  }
  const base64 = await fileToBase64(file);
  const response = await apiRequest('/upload', {
    method: 'POST',
    body: JSON.stringify({
      file: base64,
      filename: file.name,
      type: type,
      equipmentId: equipmentId
    })
  });
  return response.url;
};

// 문서/이미지 파일 삭제
const deleteDocument = async (equipmentId, type, fileUrl) => {
  const typeLabel = type === 'image' ? '이미지' : '문서';
  if (!confirm(`이 ${typeLabel}를 삭제하시겠습니까?`)) {
    return false;
  }
  try {
    await apiRequest('/upload', {
      method: 'DELETE',
      body: JSON.stringify({
        equipmentId: equipmentId,
        type: type,
        fileUrl: fileUrl
      })
    });
    alert(`${typeLabel}가 삭제되었습니다.`);
    return true;
  } catch (error) {
    alert(`${typeLabel} 삭제 실패: ` + error.message);
    return false;
  }
};

// 글로벌 삭제 핸들러 (onclick에서 호출)
window.handleDeleteDocument = async (equipmentId, type, fileUrl) => {
  const deleted = await deleteDocument(equipmentId, type, fileUrl);
  if (deleted) {
    // 삭제 후 UI 업데이트
    const elementId = {
      'brochure': 'currentBrochure',
      'manual': 'currentManual',
      'quick_guide': 'currentQuickGuide'
    }[type];
    const element = document.getElementById(elementId);
    if (element) {
      element.innerHTML = '';
    }
    // 이미지인 경우 URL 입력 필드와 미리보기도 처리
    if (type === 'image') {
      document.getElementById('equipmentImageUrl').value = '';
      const previewContainer = document.getElementById('imagePreviewContainer');
      if (previewContainer) previewContainer.style.display = 'none';
    }
  }
};

// 파일 선택 시 즉시 크기 검증 + 이미지 미리보기
document.addEventListener('DOMContentLoaded', () => {
  // 문서 파일 크기 검증
  const fileInputs = ['equipmentBrochure', 'equipmentManual', 'equipmentQuickGuide'];
  fileInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && !validateFileSize(file)) {
          e.target.value = ''; // 파일 선택 취소
        }
      });
    }
  });

  // 이미지 URL 입력 시 미리보기
  const imageUrlInput = document.getElementById('equipmentImageUrl');
  const imageFileInput = document.getElementById('equipmentImageFile');
  const previewContainer = document.getElementById('imagePreviewContainer');
  const previewImg = document.getElementById('imagePreview');

  if (imageUrlInput && previewContainer && previewImg) {
    imageUrlInput.addEventListener('input', (e) => {
      // 파일이 선택되어 있으면 URL 변경 무시
      if (imageFileInput && imageFileInput.files.length > 0) return;

      const url = e.target.value.trim();
      if (url) {
        previewImg.src = url;
        previewContainer.style.display = 'block';
        previewImg.onerror = () => {
          previewContainer.style.display = 'none';
        };
      } else {
        previewContainer.style.display = 'none';
      }
    });
  }

  // 이미지 파일 선택 시 미리보기 (파일 우선)
  if (imageFileInput && previewContainer && previewImg) {
    imageFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        // 파일 선택 시 URL 필드 비우기
        if (imageUrlInput) imageUrlInput.value = '';

        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        // 파일 선택 취소 시 URL 기반 미리보기로 복원
        const url = imageUrlInput?.value.trim();
        if (url) {
          previewImg.src = url;
          previewContainer.style.display = 'block';
        } else {
          previewContainer.style.display = 'none';
        }
      }
    });
  }
});

// Handle equipment form submission
document.addEventListener('DOMContentLoaded', () => {
  const equipmentForm = document.getElementById('equipmentForm');
  if (equipmentForm) {
    equipmentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Create FormData or JSON payload
      const formData = new FormData();
      const equipmentId = document.getElementById('equipmentId').value;
      const name = document.getElementById('equipmentName').value;
      const description = document.getElementById('equipmentDescription').value;
      const location = document.getElementById('equipmentLocation').value;
      const status = document.getElementById('equipmentStatus').value;
      const imageUrl = document.getElementById('equipmentImageUrl').value; // 직접 입력 URL
      const imageFile = document.getElementById('equipmentImageFile').files[0]; // 업로드 파일

      // 문서 파일들
      const brochureFile = document.getElementById('equipmentBrochure')?.files[0];
      const manualFile = document.getElementById('equipmentManual')?.files[0];
      const quickGuideFile = document.getElementById('equipmentQuickGuide')?.files[0];

      try {
        let savedEquipmentId = equipmentId;

        if (equipmentId) {
          // Update existing equipment
          const existingEquipment = await getEquipmentById(equipmentId);

          // 파일 업로드 처리 (R2에 업로드하고 image_file_url 획득)
          let newImageFileUrl = existingEquipment.image_file_url;
          console.log('[DEBUG] imageFile:', imageFile);
          console.log('[DEBUG] existing image_file_url:', existingEquipment.image_file_url);

          if (imageFile) {
            console.log('[DEBUG] Uploading image file:', imageFile.name);
            // 파일을 base64로 변환
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(imageFile);
            });

            console.log('[DEBUG] Base64 length:', base64.length);
            const uploadResult = await apiRequest('/upload/image', {
              method: 'POST',
              body: JSON.stringify({
                file: base64,
                filename: imageFile.name,
                equipmentId: equipmentId
              })
            });
            console.log('[DEBUG] Upload result:', uploadResult);
            newImageFileUrl = uploadResult.url;
          }

          console.log('[DEBUG] Final newImageFileUrl:', newImageFileUrl);

          // Build update data
          // 파일 업로드: image_file_url에 저장
          // URL 직접 입력: image_url에 저장 (파일 업로드 시에는 기존값 유지)
          const data = {
            name,
            description,
            location,
            status,
            image_url: newImageFileUrl ? existingEquipment.image_url : (imageUrl || existingEquipment.image_url),
            image_file_url: newImageFileUrl || existingEquipment.image_file_url,
            brochure_url: existingEquipment.brochure_url,
            manual_url: existingEquipment.manual_url,
            quick_guide_url: existingEquipment.quick_guide_url
          };

          console.log('[DEBUG] Update data:', data);
          await updateEquipment(equipmentId, data);

          // Upload new document files if provided
          let brochureUrl = null, manualUrl = null, quickGuideUrl = null;

          if (brochureFile) {
            brochureUrl = await uploadDocument(brochureFile, 'brochure', equipmentId);
          }
          if (manualFile) {
            manualUrl = await uploadDocument(manualFile, 'manual', equipmentId);
          }
          if (quickGuideFile) {
            quickGuideUrl = await uploadDocument(quickGuideFile, 'quick_guide', equipmentId);
          }

          // Update with new document URLs if any were uploaded
          if (brochureUrl || manualUrl || quickGuideUrl) {
            await updateEquipment(equipmentId, {
              ...data,
              brochure_url: brochureUrl || data.brochure_url,
              manual_url: manualUrl || data.manual_url,
              quick_guide_url: quickGuideUrl || data.quick_guide_url
            });
          }

        } else {
          // Create new equipment
          let newImageFileUrl = null;

          // 파일 업로드 처리 (base64로 변환 후 업로드)
          if (imageFile) {
            const base64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(imageFile);
            });

            const uploadResult = await apiRequest('/upload/image', {
              method: 'POST',
              body: JSON.stringify({
                file: base64,
                filename: imageFile.name
              })
            });
            newImageFileUrl = uploadResult.url;
          }

          // 파일 업로드: image_file_url, URL 입력: image_url
          const data = {
            name,
            description,
            location,
            status,
            image_url: newImageFileUrl ? null : imageUrl,
            image_file_url: newImageFileUrl
          };
          const result = await createEquipment(data);
          savedEquipmentId = result.equipmentId;

          // 문서 파일 업로드 (새 장비 저장 후)
          if (savedEquipmentId) {
            let brochureUrl = null, manualUrl = null, quickGuideUrl = null;

            if (brochureFile) {
              brochureUrl = await uploadDocument(brochureFile, 'brochure', savedEquipmentId);
            }
            if (manualFile) {
              manualUrl = await uploadDocument(manualFile, 'manual', savedEquipmentId);
            }
            if (quickGuideFile) {
              quickGuideUrl = await uploadDocument(quickGuideFile, 'quick_guide', savedEquipmentId);
            }

            // 문서 URL이 있으면 장비 업데이트
            if (brochureUrl || manualUrl || quickGuideUrl) {
              const existingEquipment = await getEquipmentById(savedEquipmentId);
              await updateEquipment(savedEquipmentId, {
                name: existingEquipment.name,
                description: existingEquipment.description,
                location: existingEquipment.location,
                status: existingEquipment.status,
                image_url: existingEquipment.image_url,
                image_file_url: existingEquipment.image_file_url,
                brochure_url: brochureUrl || existingEquipment.brochure_url,
                manual_url: manualUrl || existingEquipment.manual_url,
                quick_guide_url: quickGuideUrl || existingEquipment.quick_guide_url
              });
            }
          }
        }

        alert(equipmentId ? '장비가 수정되었습니다.' : '장비가 추가되었습니다.');

        const modal = bootstrap.Modal.getInstance(document.getElementById('equipmentModal'));
        modal.hide();

        loadEquipmentManagement();
        loadDashboardStats();
      } catch (error) {
        alert('작업 실패: ' + error.message);
      }
    });
  }
});

// Delete equipment
window.handleDeleteEquipment = async (id) => {
  if (!confirm('이 장비를 삭제하시겠습니까? 관련된 모든 예약도 삭제됩니다.')) {
    return;
  }

  try {
    await deleteEquipment(id);
    alert('장비가 삭제되었습니다.');
    loadEquipmentManagement();
    loadDashboardStats();
  } catch (error) {
    alert('장비 삭제 실패: ' + error.message);
  }
};

// Cancel reservation (admin)
window.handleAdminCancelReservation = async (id) => {
  if (!confirm('이 예약을 취소하시겠습니까?')) {
    return;
  }

  try {
    await cancelReservation(id);
    alert('예약이 취소되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
  } catch (error) {
    alert('예약 취소 실패: ' + error.message);
  }
};

// Delete reservation (admin)
window.handleAdminDeleteReservation = async (id) => {
  if (!confirm('이 예약을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
    return;
  }

  try {
    await deleteReservation(id);
    alert('예약이 삭제되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
  } catch (error) {
    alert('예약 삭제 실패: ' + error.message);
  }
};

// Restore cancelled reservation (admin)
window.handleRestoreReservation = async (id) => {
  if (!confirm('이 예약을 복구하시겠습니까?')) {
    return;
  }

  try {
    await apiRequest(`/reservations/${id}/restore`, { method: 'PATCH' });
    alert('예약이 복구되었습니다.');
    loadReservationManagement();
    loadDashboardStats();
    loadStatistics();
  } catch (error) {
    alert('예약 복구 실패: ' + error.message);
  }
};

// Period selection helpers
window.setStatsPeriod = (period) => {
  const startInput = document.getElementById('statsStartDate');
  const endInput = document.getElementById('statsEndDate');
  if (!startInput || !endInput) return;

  const now = new Date();
  let start, end;

  switch (period) {
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'last3Months':
      start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'all':
      startInput.value = '';
      endInput.value = '';
      return;
  }

  startInput.value = start.toISOString().split('T')[0];
  endInput.value = end.toISOString().split('T')[0];
};

window.applyStatsPeriod = () => {
  const startDate = document.getElementById('statsStartDate')?.value || null;
  const endDate = document.getElementById('statsEndDate')?.value || null;
  loadStatistics(startDate, endDate);
};

// Excel export
window.exportStatsToExcel = () => {
  if (!lastStatsData) {
    alert('먼저 통계를 조회해주세요.');
    return;
  }

  if (typeof XLSX === 'undefined') {
    alert('엑셀 라이브러리가 로드되지 않았습니다.');
    return;
  }

  const wb = XLSX.utils.book_new();

  // Equipment stats sheet
  if (lastStatsData.equipmentStats && lastStatsData.equipmentStats.length > 0) {
    const eqData = lastStatsData.equipmentStats.map(eq => ({
      '장비명': eq.equipment_name,
      '총 예약': Number(eq.total_reservations || 0),
      '확정': Number(eq.confirmed_count || 0),
      '취소': Number(eq.cancelled_count || 0),
      '총 시간(h)': parseFloat(parseFloat(eq.total_hours || 0).toFixed(1))
    }));
    const eqSheet = XLSX.utils.json_to_sheet(eqData);
    XLSX.utils.book_append_sheet(wb, eqSheet, '장비별 통계');
  }

  // User stats sheet
  if (lastStatsData.userStats && lastStatsData.userStats.length > 0) {
    const userData = lastStatsData.userStats.map(user => ({
      '사용자': user.username,
      '이메일': user.email,
      '총 예약': Number(user.total_reservations || 0),
      '확정': Number(user.confirmed_count || 0),
      '취소': Number(user.cancelled_count || 0),
      '총 시간(h)': parseFloat(parseFloat(user.total_hours || 0).toFixed(1))
    }));
    const userSheet = XLSX.utils.json_to_sheet(userData);
    XLSX.utils.book_append_sheet(wb, userSheet, '사용자별 통계');
  }

  // Generate filename with date
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const startDate = document.getElementById('statsStartDate')?.value;
  const endDate = document.getElementById('statsEndDate')?.value;
  let fileName;
  if (startDate && endDate) {
    fileName = `장비예약통계_${startDate}_${endDate}.xlsx`;
  } else {
    fileName = `장비예약통계_${dateStr}.xlsx`;
  }

  XLSX.writeFile(wb, fileName);
};

// Initialize admin page
document.addEventListener('DOMContentLoaded', () => {
  // Check admin access
  requireAdmin();

  // Load all data
  loadDashboardStats();
  loadEquipmentManagement();
  loadReservationManagement();
  loadStatistics();
});

// ===== Permission Management Functions =====

// Department label mapping
const getDepartmentLabel = (dept) => {
  const labels = {
    'nano_display': '나노디스플레이연구실',
    'nano_litho': '나노리소그래피연구센터',
    'battery': '이차전지장비연구실'
  };
  return labels[dept] || dept || '-';
};

// User role label mapping
const getUserRoleLabel = (role) => {
  const labels = {
    'intern': '인턴',
    'student': '학생연구원',
    'staff': '담당',
    'equipment_manager': '장비담당자',
    'admin': '관리자'
  };
  return labels[role] || role || '-';
};

// Get permission level label
const getPermissionLevelLabel = (level) => {
  const labels = {
    'normal': '일반',
    'autonomous': '자율',
    'manager': '장비담당'
  };
  return labels[level] || '일반';
};

// Get permission level badge class
const getPermissionLevelBadge = (level) => {
  const classes = {
    'normal': 'bg-secondary',
    'autonomous': 'bg-success',
    'manager': 'bg-warning text-dark'
  };
  return classes[level] || 'bg-secondary';
};

// Open permission management modal
const openPermissionModal = async (equipmentId, equipmentName) => {
  document.getElementById('permissionEquipmentId').value = equipmentId;
  document.getElementById('permissionEquipmentName').textContent = equipmentName;

  // Load current permissions and candidates
  await loadPermissions(equipmentId);
  await loadPermissionCandidates(equipmentId);

  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('permissionModal'));
  modal.show();
};

// Load current permissions for equipment
const loadPermissions = async (equipmentId) => {
  const container = document.getElementById('permissionList');
  const countBadge = document.getElementById('permissionCount');
  try {
    const permissions = await apiRequest(`/permissions/equipment/${equipmentId}`);

    // Update count badge
    if (countBadge) countBadge.textContent = `${permissions.length}명`;

    if (permissions.length === 0) {
      container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">권한자 없음</td></tr>';
    } else {
      container.innerHTML = permissions.map(p => `
        <tr>
          <td>${p.username}</td>
          <td>${getDepartmentLabel(p.department)}</td>
          <td>
            <select class="form-select form-select-sm" style="width: 100px;" 
                    onchange="updatePermissionLevel(${equipmentId}, ${p.user_id}, this.value)">
              <option value="normal" ${p.permission_level === 'normal' ? 'selected' : ''}>일반</option>
              <option value="autonomous" ${p.permission_level === 'autonomous' ? 'selected' : ''}>자율</option>
              <option value="manager" ${p.permission_level === 'manager' ? 'selected' : ''}>장비담당</option>
            </select>
          </td>
          <td>${new Date(p.granted_at).toLocaleDateString('ko-KR')}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="revokePermission(${equipmentId}, ${p.user_id})">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="6" class="text-center text-danger">로드 실패: ${error.message}</td></tr>`;
    if (countBadge) countBadge.textContent = '0명';
  }
};

// Load users without permission (for granting)
const loadPermissionCandidates = async (equipmentId) => {
  const select = document.getElementById('permissionUserSelect');
  try {
    const users = await apiRequest(`/permissions/equipment/${equipmentId}/candidates`);

    select.innerHTML = '<option value="">사용자 선택...</option>' +
      users.map(u => `<option value="${u.id}">${u.username} (${getDepartmentLabel(u.department)}, ${getUserRoleLabel(u.user_role)})</option>`).join('');
  } catch (error) {
    select.innerHTML = '<option value="">로드 실패</option>';
  }
};

// Grant permission to user
const grantPermission = async () => {
  const equipmentId = document.getElementById('permissionEquipmentId').value;
  const userId = document.getElementById('permissionUserSelect').value;
  const permissionLevel = document.getElementById('permissionLevelSelect')?.value || 'normal';

  if (!userId) {
    alert('사용자를 선택해주세요.');
    return;
  }

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/grant`, {
      method: 'POST',
      body: JSON.stringify({ userId: parseInt(userId), permissionLevel })
    });

    // Refresh lists
    await loadPermissions(equipmentId);
    await loadPermissionCandidates(equipmentId);
  } catch (error) {
    alert('권한 부여 실패: ' + error.message);
  }
};

// Update permission level
const updatePermissionLevel = async (equipmentId, userId, permissionLevel) => {
  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/user/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ permissionLevel })
    });
  } catch (error) {
    alert('권한 수정 실패: ' + error.message);
    // Reload to reset select
    await loadPermissions(equipmentId);
  }
};

// Revoke permission from user
const revokePermission = async (equipmentId, userId) => {
  if (!confirm('이 사용자의 권한을 취소하시겠습니까?')) return;

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/revoke/${userId}`, {
      method: 'DELETE'
    });

    // Refresh lists
    await loadPermissions(equipmentId);
    await loadPermissionCandidates(equipmentId);
  } catch (error) {
    alert('권한 취소 실패: ' + error.message);
  }
};

// ===== Permission Summary Functions =====

// Load user permission summary
const loadUserPermissionSummary = async () => {
  const container = document.getElementById('userPermissionSummary');
  if (!container) return;

  try {
    const data = await apiRequest('/permissions/summary');
    const summary = data.userSummary || [];
    if (summary.length === 0) {
      container.innerHTML = '<tr><td colspan="6" class="text-center text-muted">사용자 없음</td></tr>';
    } else {
      container.innerHTML = summary.map(u => `
        <tr>
          <td>${u.id}</td>
          <td><strong>${u.username}</strong></td>
          <td>${getDepartmentLabel(u.department)}</td>
          <td>${getUserRoleLabel(u.user_role)}</td>
          <td><span class="badge bg-primary">${u.permission_count}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-primary" onclick="editUser(${u.id})" title="수정">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-success" onclick="openUserPermissionModal(${u.id}, '${u.username}')" title="권한 관리">
              <i class="bi bi-person-check"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${u.id}, '${u.username}')" title="삭제">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="6" class="text-danger">로드 실패</td></tr>`;
  }
};

// Load equipment permission summary
const loadEquipmentPermissionSummary = async () => {
  const container = document.getElementById('equipmentPermissionSummary');
  if (!container) return;

  try {
    const data = await apiRequest('/permissions/summary');
    const summary = data.equipmentSummary || [];
    if (summary.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">장비 없음</td></tr>';
    } else {
      container.innerHTML = summary.map(e => `
        <tr>
          <td>${e.name}</td>
          <td>${e.manager_name || '-'}</td>
          <td><span class="badge bg-success">${e.permission_count}</span></td>
          <td>
            <button class="btn btn-sm btn-outline-info" onclick="openPermissionModal(${e.id}, '${e.name}')">
              <i class="bi bi-eye"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="4" class="text-danger">로드 실패</td></tr>`;
  }
};

// Open user permission modal
const openUserPermissionModal = async (userId, username) => {
  document.getElementById('userPermissionUserId').value = userId;
  document.getElementById('userPermissionName').textContent = username;

  const modal = new bootstrap.Modal(document.getElementById('userPermissionModal'));
  modal.show();

  await loadUserPermissions(userId);
  await loadUserEquipmentCandidates(userId);
};

// Load user's current permissions
const loadUserPermissions = async (userId) => {
  const container = document.getElementById('userPermissionList');
  const countBadge = document.getElementById('userPermissionCount');

  try {
    const permissions = await apiRequest(`/permissions/user/${userId}`);

    if (countBadge) countBadge.textContent = `${permissions.length}개`;

    if (permissions.length === 0) {
      container.innerHTML = '<tr><td colspan="4" class="text-center text-muted">권한 없음</td></tr>';
    } else {
      container.innerHTML = permissions.map(p => `
        <tr>
          <td>${p.equipment_name}</td>
          <td>${p.location || '-'}</td>
          <td>${new Date(p.granted_at).toLocaleDateString('ko-KR')}</td>
          <td>
            <button class="btn btn-sm btn-outline-danger" onclick="revokeUserPermission(${p.equipment_id}, ${userId})">
              <i class="bi bi-x"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (error) {
    container.innerHTML = `<tr><td colspan="4" class="text-center text-danger">로드 실패</td></tr>`;
    if (countBadge) countBadge.textContent = '0개';
  }
};

// Load equipment not yet assigned to user
const loadUserEquipmentCandidates = async (userId) => {
  const select = document.getElementById('userEquipmentSelect');
  try {
    const permissions = await apiRequest(`/permissions/user/${userId}`);
    const equipment = await getEquipment();
    const permittedIds = permissions.map(p => p.equipment_id);
    const candidates = equipment.filter(e => !permittedIds.includes(e.id));

    select.innerHTML = '<option value="">장비 선택...</option>' +
      candidates.map(e => `<option value="${e.id}">${e.name} (${e.location || '-'})</option>`).join('');
  } catch (error) {
    select.innerHTML = '<option value="">로드 실패</option>';
  }
};

// Grant permission from user side
const grantUserPermission = async () => {
  const userId = document.getElementById('userPermissionUserId').value;
  const equipmentId = document.getElementById('userEquipmentSelect').value;

  if (!equipmentId) {
    alert('장비를 선택해주세요.');
    return;
  }

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/grant`, {
      method: 'POST',
      body: JSON.stringify({ userId: parseInt(userId) })
    });
    await loadUserPermissions(userId);
    await loadUserEquipmentCandidates(userId);
    loadUserPermissionSummary();
    loadEquipmentManagement();
  } catch (error) {
    alert('권한 부여 실패: ' + error.message);
  }
};

// Revoke permission from user side
const revokeUserPermission = async (equipmentId, userId) => {
  if (!confirm('이 장비 권한을 취소하시겠습니까?')) return;

  try {
    await apiRequest(`/permissions/equipment/${equipmentId}/revoke/${userId}`, {
      method: 'DELETE'
    });
    await loadUserPermissions(userId);
    await loadUserEquipmentCandidates(userId);
    loadUserPermissionSummary();
    loadEquipmentManagement();
  } catch (error) {
    alert('권한 취소 실패: ' + error.message);
  }
};

// Export all permissions to Excel
const exportPermissions = async () => {
  try {
    const permissions = await apiRequest('/permissions/export/all');

    if (permissions.length === 0) {
      alert('내보낼 권한 정보가 없습니다.');
      return;
    }

    // Format data for Excel
    const data = permissions.map(p => ({
      '장비명': p.equipment_name,
      '위치': p.location || '',
      '사용자': p.username,
      '이메일': p.email,
      '소속': getDepartmentLabel(p.department),
      '신분': getUserRoleLabel(p.user_role),
      '연수책임자': p.supervisor || '',
      '권한부여자': p.granted_by_name || '',
      '부여일': new Date(p.granted_at).toLocaleDateString('ko-KR')
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '권한현황');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `장비권한현황_${dateStr}.xlsx`);
  } catch (error) {
    alert('권한 내보내기 실패: ' + error.message);
  }
};

// ===== Manager Assignment Functions =====

// Open manager assignment modal (simple prompt version)
const openManagerModal = async (equipmentId, equipmentName) => {
  try {
    const candidates = await apiRequest('/equipment/managers/candidates');

    if (candidates.length === 0) {
      alert('담당자로 지정할 수 있는 사용자가 없습니다. (equipment_manager 또는 admin 역할 필요)');
      return;
    }

    const options = candidates.map((c, i) => `${i + 1}. ${c.username} (${getDepartmentLabel(c.department)})`).join('\n');
    const choice = prompt(`${equipmentName}의 담당자를 지정하세요:\n\n${options}\n\n번호 입력 (취소: 빈칸):`);

    if (!choice || choice.trim() === '') return;

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= candidates.length) {
      alert('올바른 번호를 입력하세요.');
      return;
    }

    await apiRequest(`/equipment/${equipmentId}/manager`, {
      method: 'PUT',
      body: JSON.stringify({ managerId: candidates[idx].id })
    });

    alert(`${equipmentName}의 담당자가 ${candidates[idx].username}(으)로 지정되었습니다.`);
    loadEquipmentManagement();
    loadEquipmentPermissionSummary();
  } catch (error) {
    alert('담당자 지정 실패: ' + error.message);
  }
};

// ===== User Edit/Delete Functions =====
const editUser = async (userId) => {
  try {
    const user = await apiRequest(`/auth/users/${userId}`);

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserName').value = user.username || '';
    document.getElementById('editUserEmail').value = user.email || '';
    document.getElementById('editUserDepartment').value = user.department || '';
    document.getElementById('editUserPhone').value = user.phone || '';
    document.getElementById('editUserRole').value = user.user_role || 'staff';
    document.getElementById('editUserSupervisor').value = user.supervisor || '';

    const modal = new bootstrap.Modal(document.getElementById('userEditModal'));
    modal.show();
  } catch (error) {
    alert('사용자 정보 로드 실패: ' + error.message);
  }
};

const deleteUser = async (userId, username) => {
  if (!confirm(`"${username}" 사용자를 삭제하시겠습니까?\n\n관련된 권한도 함께 삭제됩니다.`)) return;

  try {
    await apiRequest(`/auth/users/${userId}`, { method: 'DELETE' });
    alert('사용자가 삭제되었습니다.');
    loadUserPermissionSummary();
  } catch (error) {
    alert('사용자 삭제 실패: ' + error.message);
  }
};

// User edit form handler
document.getElementById('userEditForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const userId = document.getElementById('editUserId').value;

  try {
    await apiRequest(`/auth/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        username: document.getElementById('editUserName').value,
        email: document.getElementById('editUserEmail').value,
        department: document.getElementById('editUserDepartment').value,
        phone: document.getElementById('editUserPhone').value,
        userRole: document.getElementById('editUserRole').value,
        supervisor: document.getElementById('editUserSupervisor').value
      })
    });

    bootstrap.Modal.getInstance(document.getElementById('userEditModal')).hide();
    alert('사용자 정보가 수정되었습니다.');
    loadUserPermissionSummary();
  } catch (error) {
    alert('사용자 수정 실패: ' + error.message);
  }
});



// ===== Initialize Admin Page =====
document.addEventListener('DOMContentLoaded', () => {
  // Check admin access
  requireAdmin();

  // Load all data
  loadDashboardStats();
  loadEquipmentManagement();
  loadReservationManagement();
  loadStatistics();

  // Load permission summaries
  loadUserPermissionSummary();
});
