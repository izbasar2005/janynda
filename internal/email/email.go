package email

import (
	"fmt"
	"net/smtp"
	"os"
)

var (
	smtpHost     = "smtp.gmail.com"
	smtpPort     = "587"
	smtpEmail    string
	smtpPassword string
)

func Init() {
	smtpEmail = os.Getenv("SMTP_EMAIL")
	smtpPassword = os.Getenv("SMTP_PASSWORD")
}

func SendCode(toEmail, code string) error {
	if smtpEmail == "" || smtpPassword == "" {
		smtpEmail = os.Getenv("SMTP_EMAIL")
		smtpPassword = os.Getenv("SMTP_PASSWORD")
	}
	if smtpEmail == "" || smtpPassword == "" {
		return fmt.Errorf("SMTP_EMAIL or SMTP_PASSWORD not configured")
	}

	subject := "Janynda - Email растау коды"
	body := fmt.Sprintf("Сіздің растау кодыңыз: %s\n\nБұл кодты ешкімге бермеңіз.\nКод 5 минут ішінде жарамды.", code)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		smtpEmail, toEmail, subject, body)

	auth := smtp.PlainAuth("", smtpEmail, smtpPassword, smtpHost)
	addr := smtpHost + ":" + smtpPort

	err := smtp.SendMail(addr, auth, smtpEmail, []string{toEmail}, []byte(msg))
	if err != nil {
		return fmt.Errorf("email send failed: %w", err)
	}

	fmt.Printf("[EMAIL] code sent to %s\n", toEmail)
	return nil
}
