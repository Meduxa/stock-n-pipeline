/* ==========================================
   📊 PIPELINE / KANBAN ლოგიკა & უსაფრთხო ჩატვირთვა
   ========================================== */
const STAGES = {
    "new": { title: "🆕 ახალი ლიდი", color: "#3b82f6" },
    "processing": { title: "⏳ ლიდის დამუშავება", color: "#0ea5e9" },
    "with_sales": { title: "🧑‍💼 შეთავაზება სეილთანაა", color: "#8b5cf6" },
    "offer": { title: "📄 შეთავაზება გაგზავნილია", color: "#BA7517" },
    "negotiation": { title: "🤝 მოლაპარაკება", color: "#d97706" },
    "delivery_planned": { title: "🚚 მიწოდება დაგეგმილია / გაფორმებულია", color: "#14b8a6" },
    "closed_won": { title: "✅ მოგებული", color: "#1D9E75" },
    "closed_lost": { title: "❌ წაგებული", color: "#ef4444" }
};

let leadsData = [];

function isModalOpen(id) {
    const el = document.getElementById(id);
    return !!el && el.style.display !== 'none' && el.style.display !== '';
}

function openPipeline() {
    document.getElementById('pipelineModal').style.display = 'flex';
    renderPipeline();
}

function closePipeline() {
    document.getElementById('pipelineModal').style.display = 'none';
}

function loadLeadsFromFirebase() {
    if (isLocalMode) return;

    if (unsubscribeLeads) unsubscribeLeads();

    let query = db.collection("leads");

    if (!isAdmin) {
        query = query.where("userEmail", "==", currentUser.email);
    }

    unsubscribeLeads = query.onSnapshot((querySnapshot) => {
        leadsData = [];
        querySnapshot.forEach((doc) => {
            leadsData.push({ id: doc.id, ...doc.data() });
        });
        updateUsersDatalist();
        renderPipeline();
    }, (error) => {
        console.error("ლიდების ჩატვირთვის შეცდომა:", error);
        leadsData = [];
        renderPipeline();
    });
}

function updateLeadSelectors() {
    const leadOption = l => `<option value="${escapeHtml(`${l.clinic || 'უცნობი'} - ${l.product || ''} (${l.amount ? l.amount + ' ₾' : '0 ₾'}) | ID: ${l.id}`)}">`;
    const allLeadsHtml = leadsData.map(leadOption).join('');
    const wonLeadsHtml = leadsData.filter(l => l.stage === 'closed_won').map(leadOption).join('');

    const leadsDl = document.getElementById('leadsDatalist');
    const wonLeadsDl = document.getElementById('wonLeadsDatalist');

    if (leadsDl) leadsDl.innerHTML = allLeadsHtml;
    if (wonLeadsDl) wonLeadsDl.innerHTML = wonLeadsHtml;
}

function renderPipeline() {
    if (isLocalMode) leadsData = localLeads;
    updateLeadSelectors();
    // დაფა მხოლოდ მაშინ იხატება, როცა ფანჯარა ღიაა — ყოველი snapshot-ზე დამალული DOM-ის აგება ზედმეტია
    if (!isModalOpen('pipelineModal')) return;

    const board = document.getElementById('kanbanBoard');
    let html = '';

    let filteredLeads = leadsData;
    const searchVal = document.getElementById('pipelineFilterAdmin').value.toLowerCase().trim();
    const monthVal = document.getElementById('pipelineMonthFilter').value;

    if (isAdmin && searchVal) {
        filteredLeads = leadsData.filter(l =>
            (l.userEmail || '').toLowerCase().includes(searchVal) ||
            (l.clinic || '').toLowerCase().includes(searchVal) ||
            (l.product || '').toLowerCase().includes(searchVal)
        );
    }

    // დროის ფილტრი ვრცელდება ყველა ლიდზე
    if (monthVal) {
        filteredLeads = filteredLeads.filter(l => (l.updatedAt || l.createdAt || '').startsWith(monthVal));
    }

    const today = localISODate();
    const leadTime = l => new Date(l.updatedAt || l.createdAt || 0).getTime();

    Object.keys(STAGES).forEach(stageKey => {
        // ახალი/განახლებული ლიდები ზევით
        const stageLeads = filteredLeads.filter(l => l.stage === stageKey).sort((a, b) => leadTime(b) - leadTime(a));
        const stageAmount = stageLeads.reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

        html += `
            <div class="kanban-col" ondragover="allowDrop(event)" ondragleave="removeColHighlight(event)" ondrop="dropLead(event, '${stageKey}')">
                <div class="col-header" style="border-bottom-color: ${STAGES[stageKey].color};">
                    <div style="display:flex; justify-content: space-between; align-items:center; margin-bottom: 5px;">
                        <span>${STAGES[stageKey].title}</span>
                        <span class="col-count" style="background:${STAGES[stageKey].color}">${stageLeads.length}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-light); font-weight: 500;">
                        ჯამი: <b>${formatLari(stageAmount)} ₾</b>
                    </div>
                </div>
                <div class="kanban-cards">
                    ${stageLeads.map(l => {
                        const fileCount = (l.files && l.files.length > 0) ? l.files.length : (l.fileName ? 1 : 0);
                        const isOverdue = l.followUpDate && l.followUpDate < today && l.stage !== 'closed_won' && l.stage !== 'closed_lost';
                        const cardClass = isOverdue ? "lead-card lead-overdue" : "lead-card";

                        return `
                        <div class="${cardClass}" draggable="true" ondragstart="dragLead(event, ${jsArg(l.id)})" onclick="openLeadModal(${jsArg(l.id)})">
                            ${isAdmin ? `<div style="font-size:10.5px; color:#3b82f6; margin-bottom:6px; font-weight:600;">👤 ${escapeHtml(l.userEmail || 'უცნობი')}</div>` : ''}
                            ${l.product ? `<div class="lead-interest">🎯 ${escapeHtml(l.product)}</div>` : ''}
                            <div class="lead-title">${escapeHtml(l.clinic || 'უცნობი კლინიკა')}</div>
                            <div class="lead-clinic">👤 ${escapeHtml(l.contact || '-')}</div>
                            <div class="lead-meta-row">
                                <span>💰 ${l.amount ? parseFloat(l.amount).toLocaleString('ka-GE') + ' ₾' : '0 ₾'}</span>
                                <span>${fileCount > 0 ? '📎 ' + fileCount + ' ფაილი' : ''}</span>
                            </div>
                            ${l.followUpDate ? `<div style="font-size:11px; margin-top:5px; padding-top:5px; border-top:1px dashed var(--border); color:${isOverdue ? '#ef4444' : '#1D9E75'}; font-weight:600;">🗓 Follow-up: ${escapeHtml(l.followUpDate)} ${isOverdue ? '<span class="overdue-badge">გადაცილებული</span>' : ''}</div>` : ''}
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });
    board.innerHTML = html;
}

function dragLead(event, leadId) {
    event.dataTransfer.setData("lead_id", leadId);
}

function allowDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function removeColHighlight(event) {
    event.currentTarget.classList.remove('drag-over');
}

function dropLead(event, newStage) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');
    const leadId = event.dataTransfer.getData("lead_id");
    if (!leadId) return;

    const lead = leadsData.find(l => l.id === leadId);
    if (lead && lead.stage !== newStage) {
        const history = [...(lead.history || []), {
            date: nowStamp(),
            text: `სტატუსი შეიცვალა (${STAGES[newStage].title})`,
            author: "სისტემა"
        }];
        updateLeadInDB(leadId, { stage: newStage, updatedAt: new Date().toISOString(), history });
    }
}

// მხოლოდ შეცვლილი ველები იგზავნება — ლიდის დოკუმენტი შეიძლება შეიცავდეს დიდ base64 ფაილებს,
// რომელთა ყოველ ცვლილებაზე ხელახლა ჩაწერა ზედმეტია.
function updateLeadInDB(id, fields) {
    if (isLocalMode) {
        const idx = localLeads.findIndex(l => l.id === id);
        if (idx !== -1) localLeads[idx] = { ...localLeads[idx], ...fields };
        localStorage.setItem('stock_pipeline_leads', JSON.stringify(localLeads));
        renderPipeline();
        return Promise.resolve();
    }
    return db.collection("leads").doc(id).update(fields).catch(err => { reportSaveError(err); throw err; });
}

/* ==========================================
   📝 ლიდის დეტალები, ფაილები და თანხა
   ========================================== */
let currentEditingLead = null;
let tempFiles = [];

function openLeadModal(leadId = null) {
    document.getElementById('leadModal').style.display = 'flex';
    document.getElementById('leadNote').value = '';
    document.getElementById('leadFileUpload').value = '';
    document.getElementById('leadManagerSection').style.display = isAdmin ? 'block' : 'none';
    tempFiles = [];

    const sourceLead = leadId ? leadsData.find(l => l.id === leadId) : null;

    if (sourceLead) {
        // ასლი, რომ შეუნახავი კომენტარები ორიგინალ ლიდში არ მოხვდეს, თუ ფანჯარა შენახვის გარეშე დაიხურა
        currentEditingLead = { ...sourceLead, history: [...(sourceLead.history || [])] };
        document.getElementById('leadModalTitle').innerText = "ლიდის რედაქტირება";
        document.getElementById('leadId').value = leadId;
        document.getElementById('leadManagerEmail').value = currentEditingLead.userEmail || '';
        document.getElementById('leadClinic').value = currentEditingLead.clinic || '';
        document.getElementById('leadContact').value = currentEditingLead.contact || '';
        document.getElementById('leadProduct').value = currentEditingLead.product || '';
        document.getElementById('leadAmount').value = currentEditingLead.amount || '';
        document.getElementById('leadStage').value = currentEditingLead.stage || 'new';
        document.getElementById('leadFollowUp').value = currentEditingLead.followUpDate || '';

        const authorEl = document.getElementById('leadAuthorDisplay');
        if (isAdmin && currentEditingLead.userEmail) {
            authorEl.style.display = 'block';
            authorEl.innerText = 'დაამატა: ' + currentEditingLead.userEmail;
        } else {
            authorEl.style.display = 'none';
        }

        renderComments(currentEditingLead.history);

        if (currentEditingLead.files && currentEditingLead.files.length > 0) {
            tempFiles = [...currentEditingLead.files];
        } else if (currentEditingLead.fileName) {
            // ძველი ფორმატი: ერთი ფაილი fileName/fileData ველებში
            tempFiles.push({ name: currentEditingLead.fileName, data: currentEditingLead.fileData, amount: 0 });
        }
        renderLeadFiles(tempFiles);
    } else {
        currentEditingLead = null;
        document.getElementById('leadModalTitle').innerText = "ახალი ლიდი";
        document.getElementById('leadAuthorDisplay').style.display = 'none';
        document.getElementById('leadManagerEmail').value = currentUser ? currentUser.email : '';
        ['leadId', 'leadClinic', 'leadContact', 'leadProduct', 'leadAmount', 'leadFollowUp']
            .forEach(id => { document.getElementById(id).value = ''; });
        document.getElementById('leadStage').value = "new";
        renderComments([]);
        renderLeadFiles([]);
    }
}

function closeLeadModal() {
    document.getElementById('leadModal').style.display = 'none';
}

function handleLeadFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    readAttachment(file, f => {
        tempFiles.push({ ...f, amount: 0 });
        renderLeadFiles(tempFiles);
    });
    event.target.value = '';
}

function renderFileBadges(files, removeFn) {
    return files.map((f, i) => `
        <div style="display:inline-flex; align-items:center; gap:8px; background:#e2f0eb; padding:6px 10px; border-radius:6px; border:1px solid #a7d8c6;">
            <a href="${safeFileHref(f.data)}" download="${escapeHtml(f.name)}" style="color:var(--primary); font-size:12px; text-decoration:none; font-weight:600;">📎 ${escapeHtml(f.name)}</a>
            <span style="cursor:pointer; color:#ef4444; font-size:14px; font-weight:bold;" onclick="${removeFn}(${i})" title="ფაილის წაშლა">✕</span>
        </div>
    `).join('');
}

function renderLeadFiles(files) {
    const box = document.getElementById('leadFileContainer');
    box.innerHTML = (files && files.length)
        ? renderFileBadges(files, 'removeTempFile')
        : '<span style="font-size:11px; color:#94a3b8">ფაილი არ არის მიმაგრებული</span>';
}

function removeTempFile(index) {
    const removedFile = tempFiles[index];
    if (removedFile && removedFile.amount) {
        const currentAmt = parseFloat(document.getElementById('leadAmount').value) || 0;
        document.getElementById('leadAmount').value = Math.max(0, currentAmt - removedFile.amount).toFixed(2);
    }
    tempFiles.splice(index, 1);
    renderLeadFiles(tempFiles);
}

function renderComments(historyArr) {
    const box = document.getElementById('leadHistoryBox');
    if (!historyArr || historyArr.length === 0) {
        box.innerHTML = '<span style="color:#94a3b8">კომენტარები არ არის...</span>';
        return;
    }
    const myEmail = currentUser ? currentUser.email : 'Admin';

    box.innerHTML = historyArr.map(h => {
        if (h.author === "სისტემა") {
            return `
            <div style="font-size: 11px; color: var(--text-light); text-align: center; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;">
                <i>${escapeHtml(h.text)} (${escapeHtml(h.date)})</i>
            </div>`;
        }

        const cClass = h.author === myEmail ? 'comment-mine' : 'comment-other';
        return `
        <div class="comment-box ${cClass}">
            <div class="comment-meta">
                <b>${escapeHtml(h.author || 'უცნობი მომხმარებელი')}</b>
                <span>${escapeHtml(h.date)}</span>
            </div>
            <div>${escapeHtml(h.text)}</div>
        </div>
        `;
    }).reverse().join('');
}

function addLeadNote() {
    const note = document.getElementById('leadNote').value.trim();
    if (!note) return;
    if (!currentEditingLead) {
        alert("ჯერ შეინახეთ ლიდი და შემდეგ დაამატეთ კომენტარი.");
        return;
    }
    currentEditingLead.history.push({
        date: nowStamp(),
        text: note,
        author: currentUser ? currentUser.email : 'Admin'
    });
    renderComments(currentEditingLead.history);
    document.getElementById('leadNote').value = '';
}

function saveLead() {
    const id = document.getElementById('leadId').value;
    const data = {
        clinic: document.getElementById('leadClinic').value.trim(),
        contact: document.getElementById('leadContact').value.trim(),
        product: document.getElementById('leadProduct').value.trim(),
        amount: parseFloat(document.getElementById('leadAmount').value) || 0,
        stage: document.getElementById('leadStage').value,
        followUpDate: document.getElementById('leadFollowUp').value,
        updatedAt: new Date().toISOString(),
        files: tempFiles,
        fileName: null,
        fileData: null
    };

    if (isAdmin) {
        const customEmail = document.getElementById('leadManagerEmail').value.trim();
        if (customEmail) data.userEmail = customEmail;
    } else if (!id) {
        data.userEmail = currentUser ? currentUser.email : "";
    }

    if (id) {
        data.history = currentEditingLead ? currentEditingLead.history : [];
        updateLeadInDB(id, data).then(closeLeadModal, () => {});
        return;
    }

    data.userId = currentUser ? currentUser.uid : "local_user_1";
    data.history = [{ date: nowStamp(), text: "შეიქმნა ლიდი", author: "სისტემა" }];
    data.createdAt = data.updatedAt;

    if (isLocalMode) {
        data.id = "lead_" + Date.now();
        localLeads.push(data);
        localStorage.setItem('stock_pipeline_leads', JSON.stringify(localLeads));
        closeLeadModal();
        renderPipeline();
    } else {
        db.collection("leads").add(data).then(closeLeadModal).catch(reportSaveError);
    }
}

function extractLeadId(inputValue) {
    const match = inputValue.match(/\| ID: (.*)$/);
    return match ? match[1] : null;
}

/* ---------- ინვოისის / შეთავაზების / შეკვეთის ლიდზე მიბმა ---------- */
// amount: რიცხვითი ჯამი (არა ეკრანიდან წაკითხული ტექსტი, რომელიც ქართულ ფორმატში "1234,50" ჩანს)
function attachDocumentToLead({ inputId, printAreaId, filePrefix, amount, historyText, emptyMsg, successMsg, onDone }) {
    const leadId = extractLeadId(document.getElementById(inputId).value);
    if (!leadId) { alert(emptyMsg); return; }

    const lead = leadsData.find(l => l.id === leadId);
    if (!lead) { alert("ლიდი ვერ მოიძებნა. განაახლეთ სია და სცადეთ თავიდან."); return; }

    const file = {
        name: `${filePrefix}_${localISODate()}_${Date.now()}.html`,
        data: "data:text/html;charset=utf-8," + encodeURIComponent(document.getElementById(printAreaId).innerHTML),
        amount: amount
    };
    const fields = {
        amount: (parseFloat(lead.amount) || 0) + amount,
        files: [...(lead.files || []), file],
        history: [...(lead.history || []), {
            date: nowStamp(),
            text: historyText,
            author: currentUser ? currentUser.email : "სისტემა"
        }],
        updatedAt: new Date().toISOString()
    };
    updateLeadInDB(leadId, fields).then(() => {
        alert(successMsg);
        onDone();
    }, () => {});
}

function attachInvoiceToLead() {
    attachDocumentToLead({
        inputId: 'invoiceLeadTarget', printAreaId: 'invoicePrintArea', filePrefix: 'ინვოისი',
        amount: calcTotal,
        historyText: `მიმაგრდა ახალი ინვოისი (თანხა დაემატა: ${calcTotal} ₾)`,
        emptyMsg: "გთხოვთ აირჩიოთ ლიდი სიიდან!",
        successMsg: "ინვოისი წარმატებით მიმაგრდა არჩეულ ლიდს და თანხა დაჯამდა!",
        onDone: closeInvoice
    });
}

function attachOfferToLead() {
    attachDocumentToLead({
        inputId: 'offerLeadTarget', printAreaId: 'offerPrintArea', filePrefix: 'შეთავაზება',
        amount: offerTotal,
        historyText: `მიმაგრდა ახალი შეთავაზება (თანხა დაემატა: ${offerTotal} ₾)`,
        emptyMsg: "გთხოვთ აირჩიოთ ლიდი სიიდან!",
        successMsg: "შეთავაზება წარმატებით მიმაგრდა არჩეულ ლიდს და თანხა დაჯამდა!",
        onDone: closeOfferModal
    });
}

function attachOrderToLead() {
    attachDocumentToLead({
        inputId: 'orderLeadTarget', printAreaId: 'orderPrintArea', filePrefix: 'შეკვეთა',
        amount: 0, // შეკვეთა მოგებულ ლიდზეა — თანხა უკვე დათვლილია
        historyText: `მიმაგრდა ახალი შეკვეთა`,
        emptyMsg: "გთხოვთ აირჩიოთ მოგებული ლიდი სიიდან!",
        successMsg: "შეკვეთა წარმატებით მიმაგრდა არჩეულ მოგებულ ლიდს!",
        onDone: closeOrderModal
    });
}
