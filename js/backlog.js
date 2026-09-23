/* ==========================================
   📋 BACKLOG (TASKS KANBAN) LOGIC
   ========================================== */
const TASK_STAGES = {
    "new_task": { title: "📝 ახალი თასქი", color: "#3b82f6" },
    "in_progress": { title: "⏳ დაწყებულია", color: "#eab308" },
    "on_hold": { title: "⏸ დაყოვნებულია", color: "#ef4444" },
    "completed": { title: "✅ შესრულებულია", color: "#10b981" }
};
const TAG_NAMES = { "gen": "🔘 ზოგადი", "eng": "🟠 საინჟინრო", "pur": "🔵 შესყიდვები", "sal": "🟢 გაყიდვები" };

let currentEditingTask = null;
let tempTaskFiles = [];
let tempChecklist = [];

function openBacklog() {
    document.getElementById('backlogModal').style.display = 'flex';
    renderBacklog();
}

function closeBacklog() {
    document.getElementById('backlogModal').style.display = 'none';
}

function loadTasksFromFirebase() {
    if(isLocalMode) return;
    if(unsubscribeTasks) unsubscribeTasks();

    let query = db.collection("tasks");
    if (!isAdmin) {
        query = query.where("userEmail", "==", currentUser.email);
    }

    unsubscribeTasks = query.onSnapshot((querySnapshot) => {
        tasksData = [];
        querySnapshot.forEach((doc) => {
            tasksData.push({ id: doc.id, ...doc.data() });
        });
        updateUsersDatalist();
        renderBacklog();
    }, (error) => {
        console.error("ტასკების ჩატვირთვის შეცდომა:", error);
        tasksData = [];
        renderBacklog();
    });
}

function renderBacklog() {
    if(isLocalMode) tasksData = localTasks;
    if (!isModalOpen('backlogModal')) return; // დამალულ დაფას ყოველ snapshot-ზე არ ვხატავთ
    const board = document.getElementById('taskBoard');
    let html = '';

    let filteredTasks = tasksData;
    const searchVal = document.getElementById('taskFilterAdmin') ? document.getElementById('taskFilterAdmin').value.toLowerCase().trim() : '';

    if (isAdmin && searchVal) {
        filteredTasks = tasksData.filter(t =>
            (t.userEmail || '').toLowerCase().includes(searchVal) ||
            (t.title || '').toLowerCase().includes(searchVal)
        );
    }

    Object.keys(TASK_STAGES).forEach(stageKey => {
        let stageTasks = filteredTasks.filter(t => t.stage === stageKey);

        html += `
            <div class="kanban-col" ondragover="allowDropTask(event)" ondragleave="removeColHighlight(event)" ondrop="dropTask(event, '${stageKey}')">
                <div class="col-header" style="border-bottom-color: ${TASK_STAGES[stageKey].color};">
                    <div style="display:flex; justify-content: space-between; align-items:center;">
                        <span>${TASK_STAGES[stageKey].title}</span>
                        <span class="col-count" style="background:${TASK_STAGES[stageKey].color}">${stageTasks.length}</span>
                    </div>
                </div>
                <div class="kanban-cards">
                    ${stageTasks.map(t => {
                        const prioClass = t.priority === 'high' ? 'priority-high' : t.priority === 'low' ? 'priority-low' : 'priority-med';
                        const tagClass = TAG_NAMES[t.tag] ? 'tag-' + t.tag : 'tag-gen'; // მხოლოდ ცნობილი თეგები
                        const checkedCount = (t.checklist || []).filter(c => c.done).length;
                        const totalCheck = (t.checklist || []).length;
                        const fileCount = (t.files || []).length;

                        return `
                        <div class="task-card ${prioClass}" draggable="true" ondragstart="dragTask(event, ${jsArg(t.id)})" onclick="openTaskModal(${jsArg(t.id)})">
                            ${isAdmin ? `<div style="font-size:10.5px; color:#3b82f6; margin-bottom:6px; font-weight:600;">👤 ${escapeHtml(t.userEmail || 'უცნობი')}</div>` : ''}

                            <span class="task-tag ${tagClass}">${TAG_NAMES[t.tag] || TAG_NAMES['gen']}</span>

                            <div class="task-title">${escapeHtml(t.title || 'უცნობი ტასკი')}</div>

                            <div class="task-meta">
                                <span>${totalCheck > 0 ? `✅ ${checkedCount}/${totalCheck}` : ''}</span>
                                <span>${fileCount > 0 ? '📎 ' + fileCount : ''}</span>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    if(board) board.innerHTML = html;
}

function dragTask(event, taskId) {
    event.dataTransfer.setData("task_id", taskId);
}

function allowDropTask(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function dropTask(event, newStage) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const taskId = event.dataTransfer.getData("task_id");
    if(!taskId) return;

    const task = tasksData.find(t => t.id === taskId);
    if(task && task.stage !== newStage) {
        updateTaskInDB(taskId, { stage: newStage, updatedAt: new Date().toISOString() });
    }
}

// მხოლოდ შეცვლილი ველები იგზავნება (ტასკი შეიძლება შეიცავდეს დიდ ფაილებს)
function updateTaskInDB(id, fields) {
    if(isLocalMode) {
        const idx = localTasks.findIndex(t => t.id === id);
        if(idx !== -1) localTasks[idx] = { ...localTasks[idx], ...fields };
        localStorage.setItem('stock_pipeline_tasks', JSON.stringify(localTasks));
        renderBacklog();
        return Promise.resolve();
    }
    return db.collection("tasks").doc(id).update(fields).catch(err => { reportSaveError(err); throw err; });
}

function openTaskModal(taskId = null) {
    document.getElementById('taskModal').style.display = 'flex';
    document.getElementById('taskFileUpload').value = '';
    document.getElementById('taskChecklistInput').value = '';
    tempTaskFiles = [];
    tempChecklist = [];

    if (isAdmin) {
        document.getElementById('taskManagerSection').style.display = 'block';
    } else {
        document.getElementById('taskManagerSection').style.display = 'none';
    }

    currentEditingTask = taskId ? tasksData.find(t => t.id === taskId) : null;
    if (currentEditingTask) {
        document.getElementById('taskModalTitle').innerText = "ტასკის რედაქტირება";
        document.getElementById('taskId').value = taskId;
        document.getElementById('taskTitle').value = currentEditingTask.title || '';
        document.getElementById('taskManagerEmail').value = currentEditingTask.userEmail || '';
        document.getElementById('taskPriority').value = currentEditingTask.priority || 'med';
        document.getElementById('taskTag').value = currentEditingTask.tag || 'gen';
        document.getElementById('taskStage').value = currentEditingTask.stage || 'new_task';

        if(isAdmin && currentEditingTask.userEmail) {
            document.getElementById('taskAuthorDisplay').style.display = 'block';
            document.getElementById('taskAuthorDisplay').innerText = 'დაევალა: ' + currentEditingTask.userEmail;
        } else {
            document.getElementById('taskAuthorDisplay').style.display = 'none';
        }

        if (currentEditingTask.files) {
            tempTaskFiles = [...currentEditingTask.files];
        }
        if (currentEditingTask.checklist) {
            // ღრმა ასლი: მონიშვნა არ უნდა შეიცვალოს ორიგინალ ტასკში შენახვამდე
            tempChecklist = currentEditingTask.checklist.map(c => ({ ...c }));
        }

        renderTaskFiles();
        renderChecklist();

    } else {
        document.getElementById('taskModalTitle').innerText = "ახალი ტასკი";
        document.getElementById('taskAuthorDisplay').style.display = 'none';
        document.getElementById('taskId').value = "";
        document.getElementById('taskTitle').value = "";
        document.getElementById('taskManagerEmail').value = currentUser ? currentUser.email : '';
        document.getElementById('taskPriority').value = "med";
        document.getElementById('taskTag').value = "gen";
        document.getElementById('taskStage').value = "new_task";
        renderTaskFiles();
        renderChecklist();
    }
}

function closeTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
}

function handleTaskFileUpload(event) {
    const file = event.target.files[0];
    if(!file) return;
    readAttachment(file, f => {
        tempTaskFiles.push(f);
        renderTaskFiles();
    });
    event.target.value = '';
}

function renderTaskFiles() {
    const box = document.getElementById('taskFileContainer');
    box.innerHTML = tempTaskFiles.length
        ? renderFileBadges(tempTaskFiles, 'removeTaskFile')
        : '<span style="font-size:11px; color:#94a3b8">ფაილი არ არის მიმაგრებული</span>';
}

function removeTaskFile(index) {
    tempTaskFiles.splice(index, 1);
    renderTaskFiles();
}

function addTaskChecklistItem() {
    const txt = document.getElementById('taskChecklistInput').value.trim();
    if(!txt) return;
    tempChecklist.push({ id: Date.now().toString(), text: txt, done: false });
    document.getElementById('taskChecklistInput').value = '';
    renderChecklist();
}

function toggleChecklistItem(id) {
    const item = tempChecklist.find(c => c.id === id);
    if(item) {
        item.done = !item.done;
        renderChecklist();
    }
}

function renderChecklist() {
    const box = document.getElementById('taskChecklistBox');
    const prog = document.getElementById('taskChecklistProgress');

    if(tempChecklist.length === 0) {
        box.innerHTML = '<span style="font-size:11px; color:#94a3b8">ჩექლისტი ცარიელია...</span>';
        prog.style.width = '0%';
        return;
    }

    let doneCount = tempChecklist.filter(c => c.done).length;
    let percent = (doneCount / tempChecklist.length) * 100;
    prog.style.width = percent + '%';

    box.innerHTML = tempChecklist.map(c => `
        <div class="checklist-item ${c.done ? 'done' : ''}">
            <input type="checkbox" ${c.done ? 'checked' : ''} onchange="toggleChecklistItem(${jsArg(c.id)})">
            <span class="checklist-text">${escapeHtml(c.text)}</span>
        </div>
    `).join('');
}

function saveTask() {
    const id = document.getElementById('taskId').value;
    const title = document.getElementById('taskTitle').value.trim();

    if(!title) { alert("მიუთითეთ ტასკის დასახელება!"); return; }

    const data = {
        title: title,
        priority: document.getElementById('taskPriority').value,
        tag: document.getElementById('taskTag').value,
        stage: document.getElementById('taskStage').value,
        updatedAt: new Date().toISOString(),
        files: tempTaskFiles,
        checklist: tempChecklist
    };

    if (isAdmin) {
        const customEmail = document.getElementById('taskManagerEmail').value.trim();
        if(customEmail) data.userEmail = customEmail;
    } else if (!id) {
        data.userEmail = currentUser ? currentUser.email : "";
    }

    if (id) {
        updateTaskInDB(id, data).then(closeTaskModal, () => {});
    } else {
        data.createdAt = data.updatedAt;
        if(isLocalMode) {
            data.id = "task_" + Date.now();
            localTasks.push(data);
            localStorage.setItem('stock_pipeline_tasks', JSON.stringify(localTasks));
            closeTaskModal(); renderBacklog();
        } else {
            db.collection("tasks").add(data).then(() => closeTaskModal()).catch(reportSaveError);
        }
    }
}
