import nodemailer from 'nodemailer';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

export async function sendEmail({
    to,
    subject,
    html,
}: {
    to: string | string[];
    subject: string;
    html: string;
}): Promise<{ success: boolean; messageId?: string; error?: unknown }> {
    try {
        const info = await transporter.sendMail({
            from: `"${process.env.MAIL_FROM_NAME}" <${process.env.GMAIL_USER}>`,
            to: Array.isArray(to) ? to.join(', ') : to,
            subject,
            html,
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email gönderilemedi:', error);
        return { success: false, error };
    }
}
