// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.notificarCambioOC = functions.firestore
  .document("ordenesCompra/{ocId}")
  .onUpdate(async (change, context) => {
    const after = change.after.data();
    const before = change.before.data();

    // Solo notificar si el estado cambió
    if (after.estado !== before.estado) {
      // Obtén el email del responsable siguiente según tu lógica de flujo
      const siguienteEmail = getResponsableSiguiente(after.estado, after); // define esta función
      if (!siguienteEmail) return null;

      // Busca todos los tokens activos
      const tokensSnap = await admin.firestore()
        .collection("usuarios")
        .doc(siguienteEmail)
        .collection("tokens")
        .where("activo", "==", true)
        .get();

      const tokens = tokensSnap.docs.map(doc => doc.data().token);
      if (tokens.length === 0) return null;

      const payload = {
        notification: {
          title: `OC #${after.numeroOC || context.params.ocId} requiere tu acción`,
          body: `Estado actualizado a: ${after.estado}`,
          icon: "/logo-navbar.png",
        },
        data: {
          ocId: context.params.ocId,
        },
      };

      await admin.messaging().sendToDevice(tokens, payload);

      return null;
    }
    return null;
  });
