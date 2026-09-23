/* ==========================================
   🤝 კომერციული შეთავაზება (ნებისმიერი კოდით, სტოკის გარეშეც)
   ========================================== */
let offerTotal = 0; // შეთავაზების ჯამი რიცხვად (ლიდზე მიბმისთვის)

function openOfferModal() {
    document.getElementById('offerModal').style.display = 'flex';
    document.getElementById('offerDate').innerText = new Date().toLocaleDateString('ka-GE');
    renderOfferTable();
}
function closeOfferModal() { document.getElementById('offerModal').style.display = 'none'; }

function updateOfferHeader() { renderClientHeader('offerClientSearch', 'offerClientDisplay'); }

function handleOfferSearch() {
    const q = document.getElementById('offerCodeInput').value.toLowerCase().trim();
    const resBox = document.getElementById('offerSearchResults');
    if (!q) { resBox.style.display = 'none'; return; }

    const matches = DATA.filter(p => p.enabled && p.code.toLowerCase().startsWith(q)).slice(0, 10);

    if (matches.length === 0) {
        resBox.style.display = 'none';
        return;
    }

    resBox.innerHTML = matches.map(p => `
        <div class="search-item" onclick="selectOfferCode(${jsArg(p.code)})">
            <div class="search-item-info">
                <span style="font-weight:600; color:var(--text-dark);">#${escapeHtml(p.code)}</span>
                <span style="font-size:11px; color:var(--text-light);">${escapeHtml(p.name)}</span>
            </div>
        </div>
    `).join('');
    resBox.style.display = 'block';
}

function selectOfferCode(code) {
    const product = findProduct(code);
    document.getElementById('offerCodeInput').value = code;
    document.getElementById('offerNameInput').value = product ? product.name : '';
    document.getElementById('offerSearchResults').style.display = 'none';
}

function addOfferItem() {
    const codeInput = document.getElementById('offerCodeInput').value.trim();
    const nameInput = document.getElementById('offerNameInput').value.trim();
    if (!codeInput) { alert("გთხოვთ, შეიყვანოთ პროდუქტის კოდი."); return; }

    const aux = lookupAux(codeInput);
    const existingItem = offerItems.find(item => item.code === codeInput);
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        offerItems.push({
            code: codeInput,
            name: nameInput || "-",
            features: aux ? aux.features : "-",
            country: (aux && aux.country) || "-",
            warranty: (aux && aux.warranty) || "-",
            qty: 1,
            price: 0
        });
    }

    document.getElementById('offerCodeInput').value = '';
    document.getElementById('offerNameInput').value = '';
    renderOfferTable();
}

function findOfferItem(code) { return offerItems.find(i => i.code === code); }

function updateOfferPrice(code, newPrice) {
    const item = findOfferItem(code);
    if (item) item.price = Math.round(parseFloat(newPrice)) || 0;
    renderOfferTable();
}

function updateOfferUsdPrice(code, newUsdPrice) {
    const item = findOfferItem(code);
    if (item) item.price = Math.round((parseFloat(newUsdPrice) || 0) * currentUsdRate);
    renderOfferTable();
}

function updateOfferQty(code, delta) {
    const item = findOfferItem(code);
    if (item) {
        item.qty += delta;
        if (item.qty <= 0) removeOfferItem(code);
    }
    renderOfferTable();
}
function removeOfferItem(code) { offerItems = offerItems.filter(i => i.code !== code); renderOfferTable(); }

function renderOfferTable() {
    const tbody = document.getElementById('offerTableBody');
    offerTotal = 0;

    if (offerItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; padding: 30px; color: var(--text-light);">შეთავაზება ცარიელია. დაამატეთ კოდი.</td></tr>';
        document.getElementById('offerTotalAmount').innerText = '0 ₾';
        return;
    }

    tbody.innerHTML = offerItems.map(item => {
        const code = jsArg(item.code);
        const price = item.price > 0 ? Math.round(item.price) : 0;
        const rowTotal = price * item.qty;
        offerTotal += rowTotal;
        const usdPrice = price > 0 ? Math.round(price / currentUsdRate) : 0;
        const product = findProduct(item.code);

        return `
            <tr>
                <td>${productImageHtml(item.code)}</td>
                <td style="font-weight: 600;">#${escapeHtml(item.code)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td class="text-left" style="font-size:12px; line-height: 1.4;">${escapeHtml(item.features)}</td>
                <td><input type="number" class="editable-price" value="${price > 0 ? price : ''}" placeholder="ფასი" step="1" onchange="updateOfferPrice(${code}, this.value)"></td>
                <td><div style="display:flex; align-items:center; justify-content:center; gap:2px;"><span style="color: #64748b; font-weight: 600;">$</span><input type="number" class="editable-price" style="color:#64748b; border-color:#cbd5e1;" value="${usdPrice > 0 ? usdPrice : ''}" step="1" onchange="updateOfferUsdPrice(${code}, this.value)"></div></td>
                <td><div class="qty-controls"><button class="qty-btn hide-on-pdf" onclick="updateOfferQty(${code}, -1)">-</button><span class="qty-val">${item.qty}</span><button class="qty-btn hide-on-pdf" onclick="updateOfferQty(${code}, 1)">+</button></div></td>
                <td style="font-weight: 700;">${formatLariInt(rowTotal)}</td>
                <td style="font-size:12px;">${escapeHtml(item.country || '-')}</td>
                <td style="font-size:12px;">${escapeHtml(item.warranty || '-')}</td>
                ${marginCellHtml(price, product ? product.cost : 0)}
                <td class="hide-on-pdf"><button class="calc-remove-btn" onclick="removeOfferItem(${code})" title="წაშლა">✕</button></td>
            </tr>
        `;
    }).join('');

    document.getElementById('offerTotalAmount').innerText = formatLariInt(offerTotal) + ' ₾';
}

function generateOfferPDF() {
    if (offerItems.length === 0) { alert("შეთავაზება ცარიელია!"); return; }
    printDocument('printing-offer', "Offer_" + new Date().toLocaleDateString('ka-GE'));
}
