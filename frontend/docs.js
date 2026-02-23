const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.DOCS_PORT || 5000;

// Serve the Docsify documentation from the /docs folder
app.use(express.static(path.join(__dirname, 'docs')));

app.listen(PORT, () => {
    console.log(`Frontend (Docsify) is running at http://localhost:${PORT}`);
    console.log(`Make sure your backend is running at http://localhost:3000`);
});
