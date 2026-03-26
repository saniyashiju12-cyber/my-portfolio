async function handleChat(e) {
    if (e.key === "Enter") {
        const input = document.getElementById('chat-input');
        const body = document.getElementById('chat-body');
        const userMsg = input.value.trim();

        if (!userMsg) return;

        // 1. Show User Message
        appendMessage('user-msg', userMsg);
        input.value = "";

        try {
            // 2. Send to your Backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });

            const data = await response.json();
            
            // 3. Show Gemini's Response
            appendMessage('bot-msg', data.reply);
        } catch (error) {
            appendMessage('bot-msg', "Sorry, I'm having trouble connecting right now.");
        }
    }
}

function appendMessage(className, text) {
    const body = document.getElementById('chat-body');
    const msg = document.createElement('p');
    msg.className = className;
    msg.textContent = text;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
}