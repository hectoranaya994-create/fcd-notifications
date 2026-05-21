const admin = require('firebase-admin');

// Inicializar Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://first-class-drive-dcf90-default-rtdb.firebaseio.com'
});

const db = admin.database();

console.log('🚗 FCD Notification Server iniciado...');

// Escuchar cambios en trips
db.ref('trips').on('child_changed', async (snap) => {
  const trip = snap.val();
  const tripKey = snap.key;

  if (!trip || !trip.driverKey) return;

  // Obtener el token FCM del conductor
  const driverSnap = await db.ref(`drivers/${trip.driverKey}/fcmToken`).get();
  const fcmToken = driverSnap.val();

  if (!fcmToken) return;

  let title = '';
  let body = '';

  // Determinar el mensaje según el estado
  switch (trip.status) {
    case 'assigned':
      title = '🚗 Nuevo viaje asignado';
      body = `Cliente: ${trip.clientName || '—'} | ${trip.origin || '—'}`;
      break;
    case 'cancelled':
      title = '❌ Viaje cancelado';
      body = `El viaje #${trip.id || tripKey.slice(-4)} fue cancelado`;
      break;
    case 'approved':
      title = '✅ Servicio aprobado';
      body = `Tu servicio fue aprobado. Total: $${trip.price || 0}`;
      break;
    default:
      return; // No notificar otros estados al conductor
  }

  // Enviar notificación FCM
  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      webpush: {
        notification: {
          title,
          body,
          icon: 'https://hectoranaya994-create.github.io/fcd-conductor/icon-192.png',
          badge: 'https://hectoranaya994-create.github.io/fcd-conductor/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
        fcmOptions: {
          link: 'https://hectoranaya994-create.github.io/fcd-conductor/'
        }
      }
    });
    console.log(`✅ Notificación enviada a ${trip.driverKey}: ${title}`);
  } catch (err) {
    console.error(`❌ Error enviando notificación:`, err.message);
    // Si el token es inválido, limpiarlo
    if (err.code === 'messaging/registration-token-not-registered') {
      await db.ref(`drivers/${trip.driverKey}/fcmToken`).remove();
    }
  }
});

// Escuchar nuevos trips asignados
db.ref('trips').on('child_added', async (snap) => {
  const trip = snap.val();
  const tripKey = snap.key;

  if (!trip || !trip.driverKey || trip.status !== 'assigned') return;

  const driverSnap = await db.ref(`drivers/${trip.driverKey}/fcmToken`).get();
  const fcmToken = driverSnap.val();
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: {
        title: '🚗 Nuevo viaje asignado',
        body: `Cliente: ${trip.clientName || '—'} | ${trip.origin || '—'}`
      },
      webpush: {
        notification: {
          title: '🚗 Nuevo viaje asignado',
          body: `Cliente: ${trip.clientName || '—'} | ${trip.origin || '—'}`,
          icon: 'https://hectoranaya994-create.github.io/fcd-conductor/icon-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200],
        },
        fcmOptions: {
          link: 'https://hectoranaya994-create.github.io/fcd-conductor/'
        }
      }
    });
    console.log(`✅ Notificación nuevo viaje enviada a ${trip.driverKey}`);
  } catch (err) {
    console.error(`❌ Error:`, err.message);
  }
});

// Mantener el proceso vivo
setInterval(() => {
  console.log(`💓 Servidor activo: ${new Date().toLocaleTimeString()}`);
}, 60000);
