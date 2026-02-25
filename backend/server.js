const express = require("express");
const cors = require("cors");
const { App } = require("octokit");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Helper to authenticate as GitHub App
async function getOctokit(owner) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        throw new Error("Missing GitHub credentials (GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY)");
    }

    try {
        const normalizedKey = privateKey.replace(/\\n/g, '\n').trim();
        const githubApp = new App({
            appId: parseInt(appId, 10),
            privateKey: normalizedKey,
        });

        const { data: installations } = await githubApp.octokit.rest.apps.listInstallations();
        let targetInstallId;

        if (owner) {
            const match = installations.find((i) => i.account?.login === owner);
            if (match) targetInstallId = match.id;
        }

        if (!targetInstallId && installations.length > 0) {
            targetInstallId = installations[0].id;
        }

        if (!targetInstallId) {
            throw new Error("No installation found for this GitHub App.");
        }

        return await githubApp.getInstallationOctokit(targetInstallId);
    } catch (e) {
        console.error("Auth Error:", e.message);
        throw e;
    }
}

// 1. List Issues (All: Open & Closed)
app.get("/api/issues/list", async (req, res) => {
    try {
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        console.log(`TB: Fetching all issues for ${owner}/${repo}...`);

        const data = await octokit.paginate("GET /repos/{owner}/{repo}/issues", {
            owner,
            repo,
            state: 'all',
            per_page: 100
        });

        const issues = data
            .filter(i => !i.pull_request)
            .map(issue => {
                const body = issue.body || '';
                let extractedText = '';

                const contextMatch = body.match(/\*\*(?:Selected Context|Selected Text|Selected Image):\*\*\n(>\s*|)(.*)/i);
                if (contextMatch) {
                    extractedText = contextMatch[2].trim();
                } else {
                    if (body.includes('**Selected Text:**\n> ')) extractedText = body.split('**Selected Text:**\n> ')[1]?.split('\n')[0]?.trim();
                    else if (body.includes('**Selected Image:**\n')) extractedText = body.split('**Selected Image:**\n')[1]?.split('\n')[0]?.trim();
                }

                const urlMatch = body.match(/(?:\*\*URL:\*\*|URL:)[\s\r\n]*(http[^\s]+)/i);
                const pageUrl = urlMatch ? urlMatch[1].trim() : '';

                return {
                    id: `issue-${issue.id}`,
                    issueNumber: issue.number,
                    title: issue.title,
                    body: body,
                    url: issue.html_url,
                    pageUrl: pageUrl,
                    selectedText: extractedText || 'No direct text reference',
                    state: (issue.state || 'open').toLowerCase()
                };
            });

        res.json({ issues });
    } catch (error) {
        console.error("TB List Error:", error);
        res.status(500).json({ error: error.message || "Failed to list issues" });
    }
});

// 2. Create Issue
app.post("/api/issues/create", async (req, res) => {
    try {
        const { title, body } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);
        const response = await octokit.rest.issues.create({ owner, repo, title, body });
        res.json({ success: true, url: response.data.html_url, number: response.data.number });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 3. Comment on Issue
app.post("/api/issues/comment", async (req, res) => {
    try {
        const { number, comment } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);
        const response = await octokit.rest.issues.createComment({ owner, repo, issue_number: number, body: comment });
        res.json({ success: true, data: response.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Close Issue
app.post("/api/issues/close", async (req, res) => {
    try {
        const { number } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);
        await octokit.rest.issues.update({ owner, repo, issue_number: number, state: "closed" });
        res.json({ success: true });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Update Issue
app.post("/api/issues/update", async (req, res) => {
    try {
        const { number, title, body } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);
        const response = await octokit.rest.issues.update({ owner, repo, issue_number: number, title, body });
        res.json({ success: true, data: response.data });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
