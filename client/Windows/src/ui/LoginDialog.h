#pragma once
#include <QDialog>
#include <QLabel>
#include <QPushButton>
#include <QNetworkAccessManager>
#include <QTcpServer>

struct OAuthConfig {
    static inline const char* CLIENT_ID = "5m0BC15abuLhrjTi";
    static inline const char* CLIENT_SECRET = "mBzr7bO9bZlJWcQVAZF02j_Ih-Nw7GjewNY7kjWolx8";
    static inline const char* REDIRECT_URI = "http://localhost:2580/";
    static constexpr int CALLBACK_PORT = 2580;
    static inline const char* SCOPE = "profile";
    static inline const char* AUTHORIZE_URL = "https://kg.campux.top/oauth/authorize";
    static inline const char* TOKEN_URL = "https://kg.campux.top/oauth/token";
    static inline const char* USERINFO_URL = "https://kg.campux.top/oauth/userinfo";
};

class LoginDialog : public QDialog {
    Q_OBJECT
public:
    explicit LoginDialog(QWidget* parent = nullptr);
    ~LoginDialog();

signals:
    void loginSuccess();

private slots:
    void onStartLogin();
    void onLogout();

private:
    void setupUi();
    void updateUi();

    // OAuth flow
    void startOAuthFlow();
    void startCallbackServer();
    void handleCallback();

    // PKCE
    static QString createCodeVerifier();
    static QString createCodeChallenge(const QString& verifier);

    // Token exchange
    void exchangeCodeForToken(const QString& code);
    void fetchUserInfo(const QString& accessToken);
    void saveSession(const QJsonObject& userInfo, const QString& accessToken);

    // UI elements
    QLabel* m_userLabel;
    QLabel* m_qqLabel;
    QLabel* m_tenantLabel;
    QPushButton* m_loginBtn;
    QPushButton* m_logoutBtn;
    QLabel* m_statusLabel;

    QNetworkAccessManager* m_manager;
    QTcpServer* m_callbackServer = nullptr;
    QString m_oauthState;
    QString m_codeVerifier;
};
