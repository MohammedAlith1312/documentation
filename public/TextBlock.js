/**
 * TextBlock.js - Vanilla JS Version
 * A standalone script for text selection, image feedback, and GitHub Issue integration.
 */

(function () {
    // --- Configuration & State ---
    // Using relative path — works on Vercel (same domain, no CORS)
    const API_BASE = '/api/issues';
    let state = {
        issues: [],
        status: 'idle',
        lastSelection: null,
        lastImage: null,
        activeIssue: null
    };

    // --- initialization ---
    function init() {
        injectStyles();
        createToastContainer();
        fetchIssues();
        bindEvents();
    }

    // --- CSS Injection (Premium Design) ---
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .tb-highlight { background-color: rgba(163, 167, 176, 0.4); color: inherit; cursor: pointer; border-radius: 4px; padding: 2px 0; transition: background 0.2s; }
            .tb-highlight:hover { background-color: rgba(163, 167, 176, 0.6); }
            .tb-image-highlight { outline: 4px solid #3b82f6; outline-offset: 2px; cursor: pointer; filter: brightness(0.9); transition: all 0.2s ease; }
            
            .tb-popup { 
                position: fixed; z-index: 9999; background: white; border-radius: 24px; 
                box-shadow: 0 10px 40px rgba(0,0,0,0.12); border: 1px solid #eee; 
                width: 320px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                animation: tb-fade-in 0.2s ease-out; overflow: hidden;
            }

            @keyframes tb-fade-in { from { opacity: 0; transform: translateY(10px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

            .tb-textarea { 
                width: 100%; border: 1px solid #f1f1f1; padding: 12px; border-radius: 16px; 
                resize: none; outline: none; font-size: 14px; margin-bottom: 12px; box-sizing: border-box;
            }
            .tb-textarea:focus { border-color: #ddd; }

            .tb-btn { 
                background: #111; color: white; border: none; padding: 10px 18px; 
                border-radius: 12px; cursor: pointer; font-weight: 600; font-size: 13px;
                transition: transform 0.1s, opacity 0.2s;
            }
            .tb-btn:active { transform: scale(0.96); }
            .tb-btn:disabled { opacity: 0.3; cursor: not-allowed; }

            .tb-toast {
                position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
                background: #111; color: white; padding: 12px 24px; border-radius: 50px;
                font-size: 14px; z-index: 10001; display: none; transition: 0.3s;
            }
        `;
        document.head.appendChild(style);
    }

    // --- Core Features ---

    function bindEvents() {
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('click', handleClick);
        document.addEventListener('mousedown', (e) => {
            if (!e.target.closest('.tb-popup')) hidePopups();
        });
    }

    async function fetchIssues() {
        try {
            const res = await fetch(`${API_BASE}/list`);
            const data = await res.json();
            if (data.issues) {
                state.issues = data.issues;
                reapplyHighlights();
            }
        } catch (e) { console.error("TB Error:", e); }
    }

    function handleMouseUp(e) {
        if (e.target.closest('.tb-popup')) return;

        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 0) {
            state.lastSelection = {
                text: text,
                range: selection.getRangeAt(0).cloneRange(),
                type: 'text'
            };
            showForm(selection.getRangeAt(0).getBoundingClientRect());
        }
    }

    function handleClick(e) {
        // 1. Existing Highlight Click
        const highlight = e.target.closest('.tb-highlight, .tb-image-highlight');
        if (highlight) {
            const issueId = highlight.getAttribute('data-issue-id');
            const issue = state.issues.find(i => i.id === issueId);
            if (issue) showCard(issue, highlight.getBoundingClientRect());
            return;
        }

        // 2. New Image Click
        if (e.target.tagName === 'IMG' && !e.target.closest('.tb-image-highlight')) {
            state.lastSelection = {
                text: `![${e.target.alt || 'image'}](${e.target.src})`,
                element: e.target,
                type: 'image'
            };
            showForm(e.target.getBoundingClientRect());
        }
    }

    // --- UI Rendering ---

    function showForm(rect) {
        hidePopups();
        const popup = document.createElement('div');
        popup.className = 'tb-popup';
        popup.id = 'tb-form';
        popup.innerHTML = `
            <div style="padding: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: #aaa; margin-bottom: 12px; letter-spacing: 0.05em;">NEW ISSUE</div>
                <textarea class="tb-textarea" id="tb-desc-input" rows="4" placeholder="What's wrong here?"></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 11px; color: #ccc;">⌘+Enter to send</span>
                    <button class="tb-btn" id="tb-submit-btn">Create Issue</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        positionPopup(popup, rect);

        const input = document.getElementById('tb-desc-input');
        input.focus();

        document.getElementById('tb-submit-btn').onclick = submitIssue;
        input.onkeydown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitIssue();
        };
    }

    async function submitIssue() {
        const input = document.getElementById('tb-desc-input');
        const text = input.value.trim();
        if (!text || state.status === 'submitting') return;

        state.status = 'submitting';
        const btn = document.getElementById('tb-submit-btn');
        btn.innerText = 'Creating...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                    body: `**Description:**\n${text}\n\n**Selected ${state.lastSelection.type === 'image' ? 'Image' : 'Text'}:**\n${state.lastSelection.type === 'image' ? '' : '> '}${state.lastSelection.text}\n\n**URL:**\n${window.location.href}`
                })
            });

            if (res.ok) {
                showToast("✓ Issue Created");
                hidePopups();
                fetchIssues();
            } else {
                const err = await res.json();
                showToast("Error: " + (err.error || 'Failed to create issue'));
            }
        } catch (e) {
            showToast("Error creating issue");
        } finally {
            state.status = 'idle';
            btn.innerText = 'Create Issue';
            btn.disabled = false;
        }
    }

    function showCard(issue, rect) {
        hidePopups();
        const popup = document.createElement('div');
        popup.className = 'tb-popup';
        popup.style.width = '350px';
        popup.innerHTML = `
            <div style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                    <div style="font-size: 10px; font-weight: 800; color: #aaa;">LINKED ISSUE</div>
                    <div style="font-size: 10px; font-weight: 800; color: #3b82f6;">#${issue.issueNumber}</div>
                </div>
                <div style="font-weight: 600; font-size: 15px; margin-bottom: 10px;">${issue.title}</div>
                <div style="font-size: 13px; color: #444; margin-bottom: 15px; line-height: 1.4;">
                    ${extractDescription(issue.body)}
                </div>
                <div style="background: #f8f9fa; padding: 12px; border-radius: 12px; font-size: 12px; color: #888; font-style: italic; margin-bottom: 20px; border-left: 4px solid #eee;">
                    "${issue.selectedText || 'Image selection'}"
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button class="tb-btn" style="flex: 1; background: #eee; color: #111;" onclick="window.open('${issue.url}', '_blank')">GitHub</button>
                    <button class="tb-btn" style="flex: 1; background: #f0f7ff; color: #3b82f6;" id="tb-edit-btn">Edit</button>
                    <button class="tb-btn" style="flex: 1; background: #f0fdf4; color: #16a34a;" id="tb-comment-btn">Comment</button>
                    <button class="tb-btn" style="flex: 1; background: #fff1f2; color: #ef4444;" id="tb-close-btn">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        positionPopup(popup, rect);

        document.getElementById('tb-close-btn').onclick = () => closeIssue(issue);
        document.getElementById('tb-edit-btn').onclick = () => showEditForm(issue, rect);
        document.getElementById('tb-comment-btn').onclick = () => showCommentForm(issue, rect);
    }

    function extractDescription(body) {
        if (!body) return '';
        if (body.includes('**Description:**\n')) {
            const parts = body.split('**Description:**\n')[1].split('\n\n**Selected');
            return parts[0].trim();
        }
        return body.substring(0, 100) + '...';
    }

    function showEditForm(issue, rect) {
        hidePopups();
        const popup = document.createElement('div');
        popup.className = 'tb-popup';
        popup.id = 'tb-edit-form';
        const currentDesc = extractDescription(issue.body);
        popup.innerHTML = `
            <div style="padding: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: #aaa; margin-bottom: 12px; letter-spacing: 0.05em;">EDIT ISSUE #${issue.issueNumber}</div>
                <textarea class="tb-textarea" id="tb-edit-input" rows="4">${currentDesc}</textarea>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="tb-btn" style="background: #eee; color: #111;" id="tb-edit-cancel">Cancel</button>
                    <button class="tb-btn" id="tb-update-btn">Save Changes</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        positionPopup(popup, rect);

        const input = document.getElementById('tb-edit-input');
        input.focus();

        document.getElementById('tb-edit-cancel').onclick = () => showCard(issue, rect);
        document.getElementById('tb-update-btn').onclick = () => updateIssue(issue, input.value.trim(), rect);
    }

    async function updateIssue(issue, newText, rect) {
        if (!newText || state.status === 'submitting') return;

        state.status = 'submitting';
        const btn = document.getElementById('tb-update-btn');
        btn.innerText = 'Saving...';
        btn.disabled = true;

        try {
            // Reconstruct body to include metadata + new description
            const isImage = issue.selectedText && issue.selectedText.startsWith('![');
            const contextHeader = isImage ? 'Image' : 'Text';
            const contextPrefix = isImage ? '' : '> ';
            const body = `**Description:**\n${newText}\n\n**Selected ${contextHeader}:**\n${contextPrefix}${issue.selectedText}\n\n**URL:**\n${window.location.href}`;

            const res = await fetch(`${API_BASE}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: issue.issueNumber,
                    title: newText.substring(0, 50) + (newText.length > 50 ? '...' : ''),
                    body: body
                })
            });

            if (res.ok) {
                showToast("✓ Issue Updated");
                hidePopups();
                fetchIssues();
            } else {
                showToast("Error updating issue");
            }
        } catch (e) {
            showToast("Error updating issue");
        } finally {
            state.status = 'idle';
        }
    }

    function showCommentForm(issue, rect) {
        hidePopups();
        const popup = document.createElement('div');
        popup.className = 'tb-popup';
        popup.id = 'tb-comment-form';
        popup.innerHTML = `
            <div style="padding: 20px;">
                <div style="font-size: 10px; font-weight: 800; color: #aaa; margin-bottom: 12px; letter-spacing: 0.05em;">ADD COMMENT — ISSUE #${issue.issueNumber}</div>
                <textarea class="tb-textarea" id="tb-comment-input" rows="3" placeholder="Write a comment..."></textarea>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <button class="tb-btn" style="background: #eee; color: #111;" id="tb-comment-cancel">Cancel</button>
                    <button class="tb-btn" id="tb-comment-submit-btn">Post Comment</button>
                </div>
            </div>
        `;
        document.body.appendChild(popup);
        positionPopup(popup, rect);

        const input = document.getElementById('tb-comment-input');
        input.focus();

        document.getElementById('tb-comment-cancel').onclick = () => showCard(issue, rect);
        document.getElementById('tb-comment-submit-btn').onclick = () => submitComment(issue, input.value.trim(), rect);
    }

    async function submitComment(issue, text, rect) {
        if (!text || state.status === 'submitting') return;

        state.status = 'submitting';
        const btn = document.getElementById('tb-comment-submit-btn');
        btn.innerText = 'Posting...';
        btn.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: issue.issueNumber,
                    comment: text
                })
            });

            if (res.ok) {
                showToast("✓ Comment Posted");
                hidePopups();
                // Optionally show the card again or just keep it hidden
            } else {
                showToast("Error posting comment");
            }
        } catch (e) {
            showToast("Error posting comment");
        } finally {
            state.status = 'idle';
        }
    }

    async function closeIssue(issue) {
        if (!confirm("Close this issue?")) return;
        try {
            await fetch(`${API_BASE}/close`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: issue.issueNumber })
            });
            showToast("Issue closed");
            hidePopups();
            fetchIssues();
        } catch (e) { showToast("Error closing issue"); }
    }

    // --- Helpers ---

    function reapplyHighlights() {
        document.querySelectorAll('.tb-highlight').forEach(el => {
            const parent = el.parentNode;
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            el.remove();
        });
        document.querySelectorAll('.tb-image-highlight').forEach(img => {
            img.classList.remove('tb-image-highlight');
            img.removeAttribute('data-issue-id');
        });

        state.issues.forEach(issue => {
            if (!issue.selectedText) return;

            if (issue.selectedText.startsWith('![')) {
                const srcMatch = issue.selectedText.match(/\((.*)\)/);
                if (srcMatch) {
                    const src = srcMatch[1];
                    document.querySelectorAll('img').forEach(img => {
                        if (img.src.includes(src)) {
                            img.classList.add('tb-image-highlight');
                            img.setAttribute('data-issue-id', issue.id);
                        }
                    });
                }
            } else {
                highlightText(issue);
            }
        });
    }

    function highlightText(issue) {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;
        while (node = walker.nextNode()) {
            const index = node.nodeValue.indexOf(issue.selectedText);
            if (index !== -1 && !node.parentElement.closest('.tb-highlight')) {
                const range = document.createRange();
                range.setStart(node, index);
                range.setEnd(node, index + issue.selectedText.length);
                const span = document.createElement('span');
                span.className = 'tb-highlight';
                span.setAttribute('data-issue-id', issue.id);
                range.surroundContents(span);
            }
        }
    }

    function positionPopup(popup, rect) {
        const scrollY = window.scrollY;
        let top = rect.top + scrollY - popup.offsetHeight - 15;
        let left = rect.left + (rect.width / 2) - (popup.offsetWidth / 2);

        if (top < scrollY + 10) top = rect.bottom + scrollY + 15;
        left = Math.max(10, Math.min(left, window.innerWidth - popup.offsetWidth - 10));

        popup.style.top = top + 'px';
        popup.style.left = left + 'px';
    }

    function hidePopups() {
        document.querySelectorAll('.tb-popup').forEach(el => el.remove());
    }

    function createToastContainer() {
        const t = document.createElement('div');
        t.id = 'tb-toast';
        t.className = 'tb-toast';
        document.body.appendChild(t);
    }

    function showToast(msg) {
        const t = document.getElementById('tb-toast');
        t.innerText = msg;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 3000);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
