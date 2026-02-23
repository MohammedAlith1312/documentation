const express = require("express");
const cors = require("cors");
const { App } = require("octokit");
const dotenv = require("dotenv");

dotenv.config();

const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Serve Docsify static site from public/
app.use(express.static(path.join(__dirname, "public/docs")));

const PORT = process.env.PORT || 3000;

// Helper to authenticate as GitHub App
async function getOctokit(owner) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        throw new Error("Missing GitHub authentication credentials (GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY)");
    }

    try {
        // Normalize the private key:
        // dotenv multiline quotes give real \n already — but single-line escaped gives \\n
        // This handles both safely.
        const normalizedKey = privateKey
            .replace(/\\n/g, '\n')   // convert escaped \n to real newlines
            .trim();                  // remove any leading/trailing whitespace

        const githubApp = new App({
            appId: parseInt(appId, 10),   // App ID must be a number, not a string
            privateKey: normalizedKey,
        });

        // Auto-discover installation
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
            throw new Error("No installation found for this GitHub App. Please install it on your repository.");
        }

        return await githubApp.getInstallationOctokit(targetInstallId);
    } catch (e) {
        console.error("Auth Error:", e.message);
        throw e;
    }
}

// 1. List Issues
app.get("/api/issues/list", async (req, res) => {
    try {
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        const { data } = await octokit.rest.issues.listForRepo({
            owner,
            repo,
            state: 'open',
            per_page: 100
        });

        const issues = data.map(issue => {
            const body = issue.body || '';
            let extractedText = '';
            if (body.includes('**Selected Text:**\n> ')) {
                extractedText = body.split('**Selected Text:**\n> ')[1]?.split('\n')[0]?.trim() || '';
            } else if (body.includes('**Selected Image:**\n')) {
                extractedText = body.split('**Selected Image:**\n')[1]?.split('\n')[0]?.trim() || '';
            }
            return {
                id: `issue-${issue.id}`,
                issueNumber: issue.number,
                title: issue.title,
                body: body,
                url: issue.html_url,
                selectedText: extractedText
            };
        }).filter(i => i.selectedText && i.selectedText.length > 0);

        res.json({ issues });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Create Issue
app.post("/api/issues/create", async (req, res) => {
    try {
        const { title, body } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        const response = await octokit.rest.issues.create({
            owner,
            repo,
            title,
            body,
        });

        res.json({
            success: true,
            url: response.data.html_url,
            number: response.data.number
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Comment on Issue
app.post("/api/issues/comment", async (req, res) => {
    try {
        const { number, comment } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        const response = await octokit.rest.issues.createComment({
            owner,
            repo,
            issue_number: number,
            body: comment,
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Close Issue
app.post("/api/issues/close", async (req, res) => {
    try {
        const { number } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: number,
            state: "closed",
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Update Issue
app.post("/api/issues/update", async (req, res) => {
    try {
        const { number, title, body } = req.body;
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);

        const response = await octokit.rest.issues.update({
            owner,
            repo,
            issue_number: number,
            title,
            body
        });

        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
