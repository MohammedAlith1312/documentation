const { getOctokit } = require('../_lib/octokit');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const { number, title, body } = req.body;
        if (!number) {
            return res.status(400).json({ error: 'Missing issue number' });
        }
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        const octokit = await getOctokit(owner);
        const response = await octokit.rest.issues.update({
            owner, repo,
            issue_number: number,
            title,
            body,
        });
        res.status(200).json({ success: true, data: response.data });
    } catch (error) {
        console.error('Update Error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to update issue' });
    }
};
