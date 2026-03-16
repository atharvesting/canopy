self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let data = { title: 'Project Canopy Alert', body: 'Weather Risk Update' };

    try {
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.warn('Could not parse push payload as JSON', e);
        if (event.data) {
            data.body = event.data.text();
        }
    }

    const title = data.title;
    const options = {
        body: data.body,
        vibrate: [200, 100, 200, 100, 200, 100, 200], // Aggressive ringing vibration pattern
        requireInteraction: true, // Forces the user to dismiss it
        data: data.data || { url: '/' },
        actions: [
            { action: 'open', title: 'Open App to Listen' }
        ]
    };

    const notificationPromise = self.registration.showNotification(title, options);
    const clientBroadcastPromise = clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
            for (const client of clientList) {
                client.postMessage({
                    type: 'push-notification',
                    payload: {
                        title,
                        body: data.body,
                        language: data.language || (data.data && data.data.language) || 'en',
                        data: data.data || { url: '/' }
                    }
                });
            }
        });

    event.waitUntil(Promise.all([notificationPromise, clientBroadcastPromise]));
});

self.addEventListener('notificationclick', function(event) {
    console.log('[Service Worker] Notification click Received.');

    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            for (let i = 0; i < clientList.length; i++) {
                let client = clientList[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
