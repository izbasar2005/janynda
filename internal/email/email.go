package email

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"os"
	"strings"
	"time"
)

const smtpTimeout = 15 * time.Second

func Init() {
	// Settings are read from env on each send.
}

func smtpSettings() (host, port, from, pass string, implicitTLS bool, err error) {
	from = strings.TrimSpace(os.Getenv("SMTP_EMAIL"))
	pass = strings.TrimSpace(os.Getenv("SMTP_PASSWORD"))
	if from == "" || pass == "" {
		return "", "", "", "", false, fmt.Errorf("SMTP_EMAIL or SMTP_PASSWORD not configured")
	}
	host = strings.TrimSpace(os.Getenv("SMTP_HOST"))
	if host == "" {
		host = "smtp.gmail.com"
	}
	port = strings.TrimSpace(os.Getenv("SMTP_PORT"))
	if port == "" {
		port = "587"
	}
	implicitTLS = port == "465"
	return host, port, from, pass, implicitTLS, nil
}

func SendCode(toEmail, code string) error {
	host, port, from, pass, implicitTLS, err := smtpSettings()
	if err != nil {
		return err
	}

	subject := "Janynda - Email растау коды"
	body := fmt.Sprintf("Сіздің растау кодыңыз: %s\n\nБұл кодты ешкімге бермеңіз.\nКод 5 минут ішінде жарамды.", code)
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s",
		from, toEmail, subject, body)

	addr := net.JoinHostPort(host, port)
	dialer := &net.Dialer{Timeout: smtpTimeout}

	var conn net.Conn
	if implicitTLS {
		conn, err = tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{ServerName: host})
	} else {
		conn, err = dialer.Dial("tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("smtp connect failed: %w", err)
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(smtpTimeout))

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("smtp client: %w", err)
	}
	defer client.Close()

	if !implicitTLS {
		if ok, _ := client.Extension("STARTTLS"); ok {
			if err = client.StartTLS(&tls.Config{ServerName: host}); err != nil {
				return fmt.Errorf("starttls: %w", err)
			}
		}
	}

	auth := smtp.PlainAuth("", from, pass, host)
	if err = client.Auth(auth); err != nil {
		return fmt.Errorf("smtp auth: %w", err)
	}
	if err = client.Mail(from); err != nil {
		return fmt.Errorf("smtp mail: %w", err)
	}
	if err = client.Rcpt(toEmail); err != nil {
		return fmt.Errorf("smtp rcpt: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err = w.Write([]byte(msg)); err != nil {
		return fmt.Errorf("smtp write: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("smtp close data: %w", err)
	}
	_ = client.Quit()

	fmt.Printf("[EMAIL] code sent to %s\n", toEmail)
	return nil
}
