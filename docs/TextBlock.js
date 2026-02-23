/**
 * TextBlock.js - Full Port of TextBlock.tsx
 * Comprehensive Issue Feedback System: Create, View, Edit, Comment, Close.
 * Highlights persist until the issue is closed.
 */

(function () {
    const API_BASE = '/api/issues';

    // --- Configuration & State (Ported from TSX) ---
    const state = {
        issues: [],
        status: 'idle',           // 'idle' | 'submitting'
        selectedText: '',
        selectionType: 'text',    // 'text' | 'image'
        toast: { show: false, message: '' },
        showInput: false,
        inputPosition: { top: 0, left: 0 },
        activeIssue: null,        // Currently viewed issue (hoveredIssue in TSX)
        showIssueCard: false,
        issueCardPosition: { top: 0, left: 0 },
        isEditing: false,
        editTitle: '',
        editBody: '',
        commentText: '',
        showCommentInput: false,
        selectionRange: null,     // To store range for highlighting
        lastClickedImage: null    // To store image ref
    };

    // --- Initialization ---
    function init() {
        injectStyles();
        createDOMElements();
        fetchIssues();
        bindEvents();
    }

    // --- CSS Injection (Matching TSX Premium Design) ---
    function injectStyles() {
        if (document.getElementById('tb-styles')) return;
        const style = document.createElement('style');
        style.id = 'tb-styles';
        style.textContent = `
            .issue-highlight {
                background-color: #a3a7b0ff;                 
                color: black;
                cursor: pointer;
                border-radius: 5px;
                padding: 2px 0;
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
                transition: background 0.2s;
            }
            .issue-highlight:hover { background-color: #8a8e98ff; }
            
            .issue-highlight-image {
                outline: 4px solid #3b82f6;
                outline-offset: 2px;
                cursor: pointer;
                filter: brightness(0.9);
                transition: all 0.2s ease;
            }

            .tb-popup {
                position: fixed; z-index: 9999;
                background: white; border-radius: 24px;
                box-shadow: 0 10px 40px rgba(0,0,0,0.12);
                border: 1px solid #e5e7eb;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                overflow: hidden;
                animation: tb-fade-in 0.2s ease-out;
            }

            @keyframes tb-fade-in {
                from { opacity: 0; transform: translateY(10px) scale(0.95); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .tb-textarea {
                width: 100%; box-sizing: border-box;
                border: 1px solid #f3f4f6; border-radius: 16px;
                padding: 12px; font-size: 15px; resize: none;
                focus: outline: none; color: #1f2937;
            }

            .tb-btn {
                border: none; cursor: pointer; font-weight: 600; font-size: 14px;
                padding: 10px 20px; border-radius: 14px; transition: all 0.2s;
            }
            .tb-btn-primary { background: #111; color: white; }
            .tb-btn-primary:hover { background: #000; }
            .tb-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
            
            .tb-btn-secondary { background: #f3f4f6; color: #111; border: 1px solid #e5e7eb; }
            .tb-btn-danger { background: #fff1f2; color: #ef4444; }
            
            .tb-toast {
                position: fixed; bottom: 40px; left: 50%; transform: translateX(-50%);
                background: #111; color: white; padding: 12px 24px; border-radius: 50px;
                font-size: 14px; font-weight: 500; z-index: 10001;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                display: none; animation: tb-toast-in 0.3s ease-out;
            }
            @keyframes tb-toast-in { from { bottom: 20px; opacity: 0; } to { bottom: 40px; opacity: 1; } }

            .tb-icon-btn {
                background: none; border: none; cursor: pointer; padding: 6px;
                border-radius: 50%; color: #9ca3af; transition: all 0.2s;
            }
            .tb-icon-btn:hover { background: #f3f4f6; color: #3b82f6; }
        `;
        document.head.appendChild(style);
    }

    function createDOMElements() {
        if (!document.getElementById('tb-toast-container')) {
            const toast = document.createElement('div');
            toast.id = 'tb-toast-container';
            toast.className = 'tb-toast';
            document.body.appendChild(toast);
        }
    }

    // --- Event Binding (Ported from TSX handleMouseEvent hooks) ---
    function bindEvents() {
        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('click', onDocumentClick);
        document.addEventListener('mousedown', handleClickOutside);
    }

    // --- State Handlers (The "Reducers") ---
    function showToast(message) {
        const container = document.getElementById('tb-toast-container');
        container.innerText = "✓ " + message;
        container.style.display = 'block';
        setTimeout(() => { container.style.display = 'none'; }, 3000);
    }

    function hidePopups() {
        state.showInput = false;
        state.showIssueCard = false;
        state.isEditing = false;
        state.showCommentInput = false;
        const input = document.getElementById('tb-creation-form');
        const card = document.getElementById('tb-issue-card');
        if (input) input.remove();
        if (card) card.remove();
    }

    // --- Core Logic: Fetching ---
    async function fetchIssues() {
        try {
            const res = await fetch(`${API_BASE}/list`);
            const data = await res.json();
            if (data.issues) {
                state.issues = data.issues.map(i => ({
                    id: i.id,
                    text: i.selectedText,
                    issueUrl: i.url,
                    issueNumber: i.issueNumber,
                    title: i.title,
                    description: i.body
                }));
                reapplyHighlights(state.issues);
            }
        } catch (e) { console.error("TB: Fetch failed", e); }
    }

    // --- Logic: Highlighting (Ported exactly from TSX) ---
    function reapplyHighlights(issuesToHighlight) {
        issuesToHighlight.forEach(issue => {
            if (!issue.text) return;

            if (!issue.text.startsWith('![')) {
                // Text Highlight
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const nodesToHighlight = [];
                let node;
                while (node = walker.nextNode()) {
                    const val = node.nodeValue;
                    if (val && val.includes(issue.text)) {
                        if (node.parentElement && node.parentElement.classList.contains('issue-highlight')) continue;
                        nodesToHighlight.push({ node, index: val.indexOf(issue.text) });
                    }
                }
                nodesToHighlight.forEach(({ node, index }) => {
                    try {
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + issue.text.length);
                        const span = document.createElement('span');
                        span.className = 'issue-highlight';
                        span.setAttribute('data-issue-id', issue.id);
                        range.surroundContents(span);
                    } catch (e) { }
                });
            } else {
                // Image Highlight
                const match = issue.text.match(/!\[.*\]\((.*)\)/);
                if (match) {
                    const reportedSrc = match[1];
                    document.querySelectorAll('img').forEach(img => {
                        if (img.classList.contains('issue-highlight-image')) return;
                        if (img.src === reportedSrc || img.getAttribute('src') === reportedSrc || img.src.includes(reportedSrc)) {
                            img.classList.add('issue-highlight-image');
                            img.setAttribute('data-issue-id', issue.id);
                        }
                    });
                }
            }
        });
    }

    // --- Events: Selection & Interaction ---
    function handleTextSelection() {
        if (state.showInput || state.showIssueCard) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const text = selection.toString().trim();
        if (!text) return;

        // --- Robust Collision Detection ---
        // 1. Check if the selection interacts with ANY existing highlights
        const highlights = document.querySelectorAll('.issue-highlight');
        for (const h of highlights) {
            if (selection.containsNode(h, true) || range.intersectsNode(h)) {
                const issueId = h.getAttribute('data-issue-id');
                const issue = state.issues.find(i => i.id === issueId);
                if (issue) {
                    selection.removeAllRanges();
                    openIssueCard(issue, h.getBoundingClientRect());
                    return;
                }
            }
        }

        // 2. Ancestor check (backup for deep clicks inside spans)
        let node = range.commonAncestorContainer;
        while (node && node !== document.body) {
            if (node.nodeType === 1 && node.classList.contains('issue-highlight')) {
                const issueId = node.getAttribute('data-issue-id');
                const issue = state.issues.find(i => i.id === issueId);
                if (issue) {
                    selection.removeAllRanges();
                    openIssueCard(issue, node.getBoundingClientRect());
                    return;
                }
            }
            node = node.parentNode;
        }

        // --- NEW ISSUE (Only if no collision) ---
        state.selectionRange = range.cloneRange();
        state.selectedText = text;
        state.selectionType = 'text';
        state.lastClickedImage = null;
        openCreationForm(range.getBoundingClientRect());
    }

    function onDocumentClick(e) {
        const target = e.target;

        // 1. Click on existing highlight
        if (target.classList.contains('issue-highlight') || target.classList.contains('issue-highlight-image')) {
            const issueId = target.getAttribute('data-issue-id');
            const issue = state.issues.find(i => i.id === issueId);
            if (issue) openIssueCard(issue, target.getBoundingClientRect());
            e.stopPropagation();
            return;
        }

        // 2. Click on image (new selection)
        if (target.tagName === 'IMG' && !target.classList.contains('issue-highlight-image')) {
            if (state.showInput || state.showIssueCard) return;

            // Check if this image already has an issue in state (extra safety)
            const reportedSrc = target.src || target.getAttribute('src');
            const existingIssue = state.issues.find(i => i.text.includes(reportedSrc));
            if (existingIssue) {
                openIssueCard(existingIssue, target.getBoundingClientRect());
                return;
            }

            e.preventDefault();
            const img = target;
            state.selectionType = 'image';
            state.selectedText = `![${img.alt || 'image'}](${img.src})`;
            state.lastClickedImage = img;
            state.selectionRange = null;
            openCreationForm(img.getBoundingClientRect());
        }
    }

    function handleClickOutside(e) {
        const container = document.querySelector('.tb-popup');
        if (container && !container.contains(e.target)) {
            hidePopups();
        }
    }

    // --- Popups: Creation Form ---
    function openCreationForm(rect) {
        hidePopups();
        state.showInput = true;

        const popup = document.createElement('div');
        popup.id = 'tb-creation-form';
        popup.className = 'tb-popup';
        popup.style.width = '320px';

        popup.innerHTML = `
            <div style="padding: 20px 20px 0;">
                <div style="font-size: 10px; font-weight: 800; color: #9ca3af; letter-spacing: 0.1em; margin-bottom: 12px;">NEW ${state.selectionType.toUpperCase()} ISSUE</div>
                <textarea id="tb-desc-input" class="tb-textarea" rows="4" placeholder="Description"></textarea>
            </div>
            <div style="padding: 12px 20px 20px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: #d1d5db;">⌘ + Enter to create</span>
                <button id="tb-submit-btn" class="tb-btn tb-btn-primary">Create Issue</button>
            </div>
        `;
        document.body.appendChild(popup);
        positionPopup(popup, rect);

        const input = document.getElementById('tb-desc-input');
        input.focus();
        input.onkeydown = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitNewIssue(); };
        document.getElementById('tb-submit-btn').onclick = submitNewIssue;
    }

    async function submitNewIssue() {
        const input = document.getElementById('tb-desc-input');
        const desc = input.value.trim();
        if (!desc || state.status === 'submitting') return;

        state.status = 'submitting';
        const btn = document.getElementById('tb-submit-btn');
        btn.innerText = 'Creating...';
        btn.disabled = true;

        const lines = desc.split('\n');
        const rawTitle = lines[0].substring(0, 100).trim();
        const shortTitle = rawTitle.length > 15 ? rawTitle.substring(0, 12) + '...' : rawTitle;
        const bodyContent = lines.length > 1 ? lines.slice(1).join('\n') : lines[0];

        try {
            const res = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: shortTitle || "New Issue",
                    body: `**Description:**\n${bodyContent}\n\n**Selected ${state.selectionType}:**\n${state.selectionType === 'image' ? '' : '> '}${state.selectedText}\n\n**URL:**\n${window.location.href}`
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const newIssue = {
                id: `issue-${Date.now()}`,
                text: state.selectedText,
                issueUrl: data.url,
                issueNumber: data.number,
                title: shortTitle,
                description: desc
            };

            state.issues.push(newIssue);
            applyVisualHighlight(newIssue);
            showToast("Issue Created Successfully");

            // Immediately open the card for the new issue
            let targetRect;
            if (state.selectionType === 'image' && state.lastClickedImage) {
                targetRect = state.lastClickedImage.getBoundingClientRect();
            } else if (state.selectionRange) {
                targetRect = state.selectionRange.getBoundingClientRect();
            }

            hidePopups();
            if (targetRect) openIssueCard(newIssue, targetRect);

        } catch (e) {
            console.error(e);
            showToast("Failed to create issue");
            btn.innerText = 'Create Issue';
            btn.disabled = false;
        } finally { state.status = 'idle'; }
    }

    // --- Popups: Issue Card (The "Linked Issue" View) ---
    function openIssueCard(issue, rect) {
        hidePopups();
        state.showIssueCard = true;
        state.activeIssue = issue;

        const popup = document.createElement('div');
        popup.id = 'tb-issue-card';
        popup.className = 'tb-popup';
        popup.style.width = '380px';
        renderCardContent(popup, issue, rect);

        document.body.appendChild(popup);
        positionPopup(popup, rect);
    }

    function renderCardContent(container, issue, rect) {
        if (state.isEditing) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <div style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 12px;">EDIT ISSUE</div>
                    <input id="tb-edit-title" class="tb-textarea" style="margin-bottom: 8px; font-weight:600;" value="${issue.title}">
                    <textarea id="tb-edit-body" class="tb-textarea" rows="3" style="font-size:13px;">${issue.description}</textarea>
                    <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                        <button id="tb-edit-cancel" style="background:none; border:none; cursor:pointer; color:#9ca3af; font-size:12px;">Cancel</button>
                        <button id="tb-edit-save" class="tb-btn tb-btn-primary" style="padding:6px 16px; font-size:12px; border-radius:20px;">Save</button>
                    </div>
                </div>
            `;
            document.getElementById('tb-edit-cancel').onclick = () => { state.isEditing = false; renderCardContent(container, issue, rect); };
            document.getElementById('tb-edit-save').onclick = () => saveIssueEdit(issue, container, rect);
        } else if (state.showCommentInput) {
            container.innerHTML = `
                <div style="padding: 20px;">
                    <div style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 12px;">ADD COMMENT — #${issue.issueNumber}</div>
                    <textarea id="tb-comment-text" class="tb-textarea" rows="3" placeholder="Write a comment..." autofocus></textarea>
                    <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
                        <button id="tb-comment-submit" class="tb-btn tb-btn-primary" style="padding:7px 18px; font-size:12px; border-radius:20px;">Post Comment</button>
                    </div>
                </div>
            `;
            document.getElementById('tb-comment-submit').onclick = () => submitComment(issue, container, rect);
        } else {
            const isImg = issue.text.startsWith('![');
            container.innerHTML = `
                <div style="padding: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                        <div>
                            <div style="font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 2px;">LINKED ISSUE</div>
                            <div style="font-size: 15px; font-weight: 600; color: #111;">#${issue.issueNumber} ${issue.title}</div>
                        </div>
                        <div style="display: flex; gap: 4px;">
                            <button id="tb-edit-trigger" class="tb-icon-btn" title="Edit">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                            </button>
                            <button id="tb-comment-trigger" class="tb-icon-btn" title="Comment">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.3 8.3 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.3 8.3 0 0 1-3.8-.9L3 21l1.9-5.7a8.3 8.3 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.3 8.3 0 0 1 3.8-.9h.5a8.4 8.4 0 0 1 8 8v.5z"/></svg>
                            </button>
                        </div>
                    </div>
                    
                    <div style="background: #f9fafb; padding: 14px; border-radius: 16px; border: 1px solid #f3f4f6; margin-bottom: 24px;">
                        <div style="font-size: 9px; font-weight: 800; color: #9ca3af; margin-bottom: 6px;">QUICK CONTEXT</div>
                        ${isImg ? `<div style="font-size:13px; color:#6b7280; font-style:italic;">🖼️ Image selection</div>` : `<div style="font-size:13px; color:#6b7280; font-style:italic; line-height:1.5;">"${issue.text}"</div>`}
                    </div>

                    <div style="display: flex; gap: 10px;">
                        <button id="tb-view-github" class="tb-btn tb-btn-secondary" style="flex:1;">View</button>
                        <button id="tb-close-issue" class="tb-btn tb-btn-danger" style="flex:1;">Close</button>
                    </div>
                </div>
            `;
            document.getElementById('tb-edit-trigger').onclick = () => { state.isEditing = true; renderCardContent(container, issue, rect); };
            document.getElementById('tb-comment-trigger').onclick = () => { state.showCommentInput = true; renderCardContent(container, issue, rect); };
            document.getElementById('tb-view-github').onclick = () => window.open(issue.issueUrl, '_blank');
            document.getElementById('tb-close-issue').onclick = () => closeCurrentIssue(issue);
        }
    }

    // --- Actions: Update, Comment, Close ---
    async function saveIssueEdit(issue, container, rect) {
        const title = document.getElementById('tb-edit-title').value.trim();
        const body = document.getElementById('tb-edit-body').value.trim();
        if (!title || !body) return;

        try {
            const res = await fetch(`${API_BASE}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: issue.issueNumber, title, body })
            });
            if (!res.ok) throw new Error();

            issue.title = title;
            issue.description = body;
            state.isEditing = false;
            showToast("Issue Updated Successfully");
            renderCardContent(container, issue, rect);
        } catch (e) { showToast("Failed to update issue"); }
    }

    async function submitComment(issue, container, rect) {
        const text = document.getElementById('tb-comment-text').value.trim();
        if (!text) return;

        try {
            const res = await fetch(`${API_BASE}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: issue.issueNumber, comment: text })
            });
            if (!res.ok) throw new Error();

            state.showCommentInput = false;
            showToast("Comment Added Successfully");
            renderCardContent(container, issue, rect);
        } catch (e) { showToast("Failed to add comment"); }
    }

    async function closeCurrentIssue(issue) {
        if (!confirm("Close this issue?")) return;
        try {
            const res = await fetch(`${API_BASE}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: issue.issueNumber })
            });
            if (!res.ok) throw new Error();

            // 1. Remove highlight from DOM
            document.querySelectorAll(`[data-issue-id="${issue.id}"]`).forEach(el => {
                if (el.classList.contains('issue-highlight')) {
                    const parent = el.parentNode;
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                } else {
                    el.classList.remove('issue-highlight-image');
                    el.removeAttribute('data-issue-id');
                    el.style.outline = 'none';
                }
            });

            // 2. Remove from state
            state.issues = state.issues.filter(i => i.id !== issue.id);
            hidePopups();
            showToast("Issue Closed Successfully");
        } catch (e) { showToast("Failed to close issue"); }
    }

    // --- Visual: Apply Highlight ---
    function applyVisualHighlight(issue) {
        if (state.selectionType === 'image' && state.lastClickedImage) {
            const img = state.lastClickedImage;
            img.classList.add('issue-highlight-image');
            img.setAttribute('data-issue-id', issue.id);
            return;
        }

        if (state.selectionRange) {
            const span = document.createElement('span');
            span.className = 'issue-highlight';
            span.setAttribute('data-issue-id', issue.id);
            try {
                const contents = state.selectionRange.extractContents();
                span.appendChild(contents);
                state.selectionRange.insertNode(span);
            } catch (e) {
                try { state.selectionRange.surroundContents(span); } catch (e2) { }
            }
        }
    }

    // --- Helper: Position ---
    function positionPopup(popup, rect) {
        const scrollY = window.scrollY;
        let top = rect.top + scrollY - popup.offsetHeight - 15;
        let left = rect.left + (rect.width / 2) - (popup.offsetWidth / 2);

        if (top < scrollY + 10) top = rect.bottom + scrollY + 15;
        left = Math.max(10, Math.min(left, window.innerWidth - popup.offsetWidth - 10));
        top = Math.max(10, top);

        popup.style.top = top + 'px';
        popup.style.left = left + 'px';
    }

    // --- Initialize & Docsify Integration ---
    function init() {
        injectStyles();
        createDOMElements();
        fetchIssues();
        bindEvents();
    }

    // Register as a Docsify plugin to handle page navigations
    if (window.$docsify) {
        window.$docsify.plugins = [].concat(window.$docsify.plugins || [], function (hook, vm) {
            hook.doneEach(function () {
                // Re-apply highlights every time Docsify finishes rendering a page
                if (state.issues.length > 0) {
                    reapplyHighlights(state.issues);
                }
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
