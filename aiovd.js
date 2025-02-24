async function handleRequest(request) {
    // Parse the query parameters
    const url = new URL(request.url).searchParams.get('url');

    if (!url) {
        // Return error if no URL is provided
        return new Response(
            JSON.stringify({ error: 'Please provide a video URL.' }, null, 2),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    // Prepare the data to be sent in the POST request
    const data = new URLSearchParams();
    data.append('url', url);
    data.append('token', 'c99f113fab0762d216b4545e5c3d615eefb30f0975fe107caab629d17e51b52d');

    // Set up the request options for the cURL equivalent
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14; V2336 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.135 Mobile Safari/537.36',
            'sec-ch-ua': '"Android WebView";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?1',
            'sec-ch-ua-platform': '"Android"'
        },
        body: data.toString()
    };

    try {
        // Send the POST request to the external API
        const response = await fetch('https://allvideodownloader.cc/wp-json/aio-dl/video-data/', requestOptions);

        // Check for a successful response
        if (response.ok) {
            const jsonResponse = await response.json();

            // Prepare the result to be returned
            const result = {
                title: jsonResponse.title,
                thumbnail: jsonResponse.thumbnail,
                duration: jsonResponse.duration,
                medias: jsonResponse.medias.map(media => ({
                    quality: media.quality,
                    url: media.url
                }))
            };

            // Return the result as a pretty-printed JSON response
            return new Response(JSON.stringify(result, null, 2), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            // Return error if API request failed
            return new Response(
                JSON.stringify({ error: `Error: ${response.status}` }, null, 2),
                { status: response.status, headers: { 'Content-Type': 'application/json' } }
            );
        }
    } catch (error) {
        // Return error if something goes wrong
        return new Response(
            JSON.stringify({ error: 'Error: ' + error.message }, null, 2),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}

// The Cloudflare Worker entry point
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});