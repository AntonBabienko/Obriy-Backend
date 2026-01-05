const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testUpload() {
    const API_URL = 'http://localhost:3001';

    // 1. Check initial memory
    console.log('\n=== Initial Memory ===');
    let memResponse = await fetch(`${API_URL}/memory`);
    let memData = await memResponse.json();
    console.log(memData);

    // 2. Login to get token
    console.log('\n=== Logging in ===');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: 'teacher@test.com',
            password: 'password123'
        })
    });

    if (!loginResponse.ok) {
        console.error('Login failed:', await loginResponse.text());
        return;
    }

    const { token } = await loginResponse.json();
    console.log('Token received');

    // 3. Check memory after login
    console.log('\n=== Memory After Login ===');
    memResponse = await fetch(`${API_URL}/memory`);
    memData = await memResponse.json();
    console.log(memData);

    // 4. Upload a test file
    console.log('\n=== Uploading File ===');
    const form = new FormData();

    // Create a test PDF file path (you need to provide a real file)
    const testFilePath = process.argv[2];
    if (!testFilePath || !fs.existsSync(testFilePath)) {
        console.error('Please provide a valid file path as argument');
        console.error('Usage: node test-upload-memory.js <path-to-pdf>');
        return;
    }

    form.append('file', fs.createReadStream(testFilePath));
    form.append('courseId', 'test-course-id');
    form.append('title', 'Test Lecture');

    const uploadStart = Date.now();
    const uploadResponse = await fetch(`${API_URL}/api/lectures`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            ...form.getHeaders()
        },
        body: form
    });

    const uploadTime = Date.now() - uploadStart;
    console.log(`Upload took: ${uploadTime}ms`);

    if (!uploadResponse.ok) {
        console.error('Upload failed:', await uploadResponse.text());
        return;
    }

    const uploadData = await uploadResponse.json();
    console.log('Upload successful:', uploadData.id);

    // 5. Check memory after upload
    console.log('\n=== Memory After Upload ===');
    memResponse = await fetch(`${API_URL}/memory`);
    memData = await memResponse.json();
    console.log(memData);

    // 6. Wait a bit and check again
    console.log('\n=== Waiting 5 seconds for GC ===');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n=== Memory After GC Wait ===');
    memResponse = await fetch(`${API_URL}/memory`);
    memData = await memResponse.json();
    console.log(memData);
}

testUpload().catch(console.error);
