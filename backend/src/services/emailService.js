const { Resend } = require('resend');

const APP_NAME   = 'Clarify';
const APP_URL    = process.env.APP_URL || 'https://deployclarify.vercel.app';
const FROM_EMAIL = process.env.RESEND_FROM || 'Clarify <onboarding@resend.dev>';

// ─── Shared template wrapper ──────────────────────────────────────────────────
const layout = (content) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#0D1B2A;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1B2A;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#162032;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1a3a5c,#0a2540);padding:32px 40px;text-align:center;">
            <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px;">
              <span style="color:#2DE1C2;">✦</span>
              <span style="color:#fff;margin-left:8px;">${APP_NAME}</span>
            </div>
          </td>
        </tr>
        <!-- Content -->
        <tr>
          <td style="padding:40px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="color:#4A6582;font-size:12px;margin:0;">
              ${APP_NAME} · <a href="${APP_URL}" style="color:#2DE1C2;text-decoration:none;">${APP_URL}</a>
            </p>
            <p style="color:#4A6582;font-size:11px;margin:8px 0 0;">
              Vous recevez cet email car vous avez un compte ${APP_NAME}.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Reusable button ──────────────────────────────────────────────────────────
const btn = (url, label) =>
  `<a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#2DE1C2,#1ab89d);color:#0D1B2A;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin:24px 0;">${label}</a>`;

// ─── Text helpers ─────────────────────────────────────────────────────────────
const h1 = (t) => `<h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 16px;">${t}</h1>`;
const p  = (t) => `<p style="color:#8BA3BC;font-size:15px;line-height:1.6;margin:0 0 12px;">${t}</p>`;

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

/** Welcome email sent when a new user account is created */
const welcomeTemplate = ({ name, email, tempPassword }) => layout(`
  ${h1('Bienvenue sur ' + APP_NAME + ' 👋')}
  ${p('Bonjour <strong style="color:#fff;">' + name + '</strong>,')}
  ${p('Un compte vient d\'être créé pour vous sur ' + APP_NAME + ', votre application de suivi financier personnelle.')}
  <div style="background:#0D1B2A;border-radius:12px;padding:20px;margin:20px 0;border:1px solid rgba(45,225,194,0.2);">
    <p style="color:#8BA3BC;font-size:13px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Vos identifiants</p>
    <p style="color:#fff;font-size:15px;margin:4px 0;"><strong>Email :</strong> ${email}</p>
    ${tempPassword ? `<p style="color:#fff;font-size:15px;margin:4px 0;"><strong>Mot de passe temporaire :</strong> <code style="background:#162032;padding:2px 8px;border-radius:6px;color:#2DE1C2;">${tempPassword}</code></p>` : ''}
  </div>
  ${p('Pensez à changer votre mot de passe dès votre première connexion.')}
  ${btn(APP_URL, 'Accéder à ' + APP_NAME)}
  ${p('<small style="color:#4A6582;">Si vous n\'êtes pas à l\'origine de cette création, ignorez cet email.</small>')}
`);

/** Password reset email */
const resetPasswordTemplate = ({ name, resetUrl }) => layout(`
  ${h1('Réinitialisation du mot de passe 🔑')}
  ${p('Bonjour <strong style="color:#fff;">' + name + '</strong>,')}
  ${p('Vous avez demandé à réinitialiser votre mot de passe. Cliquez sur le bouton ci-dessous — ce lien est valable <strong style="color:#fff;">30 minutes</strong>.')}
  ${btn(resetUrl, 'Réinitialiser mon mot de passe')}
  ${p('Si vous n\'avez pas fait cette demande, ignorez simplement cet email. Votre mot de passe reste inchangé.')}
  <p style="color:#4A6582;font-size:12px;margin:16px 0 0;">Ou copiez ce lien dans votre navigateur :<br/><span style="color:#2DE1C2;word-break:break-all;">${resetUrl}</span></p>
`);

/** Daily digest email */
const dailyDigestTemplate = ({ name, date, accounts, totalBalance, monthlyExpenses, monthlyIncome, topCategories }) => layout(`
  ${h1('Votre résumé du ' + date + ' 📊')}
  ${p('Bonjour <strong style="color:#fff;">' + name + '</strong>, voici votre point financier quotidien.')}

  <!-- Balance totale -->
  <div style="background:#0D1B2A;border-radius:12px;padding:20px;margin:20px 0;border:1px solid rgba(45,225,194,0.15);text-align:center;">
    <p style="color:#8BA3BC;font-size:12px;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Solde total</p>
    <p style="color:#2DE1C2;font-size:32px;font-weight:800;margin:0;">${totalBalance}</p>
  </div>

  <!-- Revenus / Dépenses du mois -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
    <tr>
      <td width="48%" style="background:#0D1B2A;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
        <p style="color:#8BA3BC;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Revenus (mois)</p>
        <p style="color:#4ADE80;font-size:22px;font-weight:700;margin:0;">+${monthlyIncome}</p>
      </td>
      <td width="4%"></td>
      <td width="48%" style="background:#0D1B2A;border-radius:12px;padding:16px;border:1px solid rgba(255,255,255,0.06);text-align:center;">
        <p style="color:#8BA3BC;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:1px;">Dépenses (mois)</p>
        <p style="color:#FF6B6B;font-size:22px;font-weight:700;margin:0;">${monthlyExpenses}</p>
      </td>
    </tr>
  </table>

  ${topCategories && topCategories.length > 0 ? `
  <div style="background:#0D1B2A;border-radius:12px;padding:20px;margin:0 0 20px;border:1px solid rgba(255,255,255,0.06);">
    <p style="color:#8BA3BC;font-size:12px;margin:0 0 14px;text-transform:uppercase;letter-spacing:1px;">Top dépenses du mois</p>
    ${topCategories.map(c => `
      <div style="display:flex;justify-content:space-between;margin-bottom:10px;">
        <span style="color:#8BA3BC;font-size:14px;">${c.name}</span>
        <span style="color:#fff;font-weight:600;font-size:14px;">${c.amount}</span>
      </div>
    `).join('')}
  </div>` : ''}

  ${btn(APP_URL, 'Voir mon tableau de bord')}
`);

// ─────────────────────────────────────────────────────────────────────────────
// SEND FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function sendMail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email to', to);
    return;
  }
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) throw error;
    console.log(`[Email] ✅ Sent "${subject}" to ${to}`);
    return data;
  } catch (err) {
    console.error(`[Email] ❌ Failed "${subject}" to ${to}:`, err.message);
  }
}

const sendWelcomeEmail = ({ name, email, tempPassword }) =>
  sendMail({ to: email, subject: `Bienvenue sur ${APP_NAME} 🎉`, html: welcomeTemplate({ name, email, tempPassword }) });

const sendPasswordResetEmail = ({ name, email, resetUrl }) =>
  sendMail({ to: email, subject: `Réinitialisation de votre mot de passe ${APP_NAME}`, html: resetPasswordTemplate({ name, resetUrl }) });

const sendDailyDigestEmail = (to, data) =>
  sendMail({ to, subject: `📊 Votre résumé ${APP_NAME} du ${data.date}`, html: dailyDigestTemplate(data) });

module.exports = { sendWelcomeEmail, sendPasswordResetEmail, sendDailyDigestEmail };
