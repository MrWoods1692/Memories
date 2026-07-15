package com.example.memories;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import frpandroid.Frpandroid;

/**
 * 管理 frpc，基于 frp_android (halifox/frp_android) 库。
 * 用户粘贴 frpc.ini 文本，自动解析为程序化配置并调用 gomobile 封装的 API。
 */
public class FrpcManager {
    private static final String TAG = "FrpcManager";
    private boolean running = false;
    private String currentConfigContent = null;
    private Context context;

    public FrpcManager(Context context) {
        this.context = context.getApplicationContext();
    }

    /**
     * 解析 frpc.ini 配置内容并启动 frpc
     * @param configContent frpc.ini 的完整文本内容
     * @return true 启动成功
     */
    public boolean startFrpc(String configContent) {
        if (running) {
            Log.w(TAG, "frpc already running");
            return true;
        }

        try {
            // 解析 INI 配置
            Map<String, Map<String, String>> sections = parseIni(configContent);

            // 构建 FrpcConfig
            frpandroid.FrpcConfig cfg = Frpandroid.newFrpcConfig();

            // 解析 [common] 段
            Map<String, String> common = sections.get("common");
            if (common != null) {
                if (common.containsKey("server_addr")) cfg.setServerAddr(common.get("server_addr"));
                if (common.containsKey("server_port")) cfg.setServerPort(Integer.parseInt(common.get("server_port")));
                if (common.containsKey("token")) cfg.setAuthToken(common.get("token"));
                if (common.containsKey("user")) cfg.setUser(common.get("user"));
                if (common.containsKey("tls_enable")) cfg.setTransportTLSEnable("true".equalsIgnoreCase(common.get("tls_enable")));
                if (common.containsKey("protocol")) cfg.setTransportProtocol(common.get("protocol"));
                if (common.containsKey("tcp_mux")) cfg.setTransportTCPMux("true".equalsIgnoreCase(common.get("tcp_mux")));
                if (common.containsKey("auth_method")) cfg.setAuthMethod(common.get("auth_method"));
                if (common.containsKey("log_file")) cfg.setLogTo(common.get("log_file"));
                if (common.containsKey("log_level")) cfg.setLogLevel(common.get("log_level"));
                if (common.containsKey("log_max_days")) cfg.setLogMaxDays(Long.parseLong(common.get("log_max_days")));
                if (common.containsKey("login_fail_exit")) cfg.setLoginFailExit("true".equalsIgnoreCase(common.get("login_fail_exit")));

                // 默认日志路径
                if (!common.containsKey("log_file")) {
                    cfg.setLogTo(new File(context.getFilesDir(), "frpc.log").getAbsolutePath());
                    cfg.setLogMaxDays(3);
                }
            }

            // 解析代理段
            for (Map.Entry<String, Map<String, String>> entry : sections.entrySet()) {
                String sectionName = entry.getKey();
                if ("common".equals(sectionName)) continue;

                Map<String, String> proxyConf = entry.getValue();
                String type = proxyConf.getOrDefault("type", "tcp");
                frpandroid.FrpcProxyConfig proxy = Frpandroid.newFrpcProxyConfig(type);
                if (proxy == null) continue;
                proxy.setName(sectionName);
                if (proxyConf.containsKey("local_ip")) proxy.setLocalIP(proxyConf.get("local_ip"));
                if (proxyConf.containsKey("local_port")) proxy.setLocalPort(Integer.parseInt(proxyConf.get("local_port")));
                if (proxyConf.containsKey("use_encryption")) proxy.setUseEncryption("true".equalsIgnoreCase(proxyConf.get("use_encryption")));
                if (proxyConf.containsKey("use_compression")) proxy.setUseCompression("true".equalsIgnoreCase(proxyConf.get("use_compression")));
                // HTTP/HTTPS/TCPMux 代理专用配置
                if (proxyConf.containsKey("custom_domains")) {
                    for (String domain : proxyConf.get("custom_domains").split(",")) {
                        String d = domain.trim();
                        if (!d.isEmpty()) proxy.addCustomDomain(d);
                    }
                }
                if (proxyConf.containsKey("subdomain")) proxy.setSubDomain(proxyConf.get("subdomain"));
                if (proxyConf.containsKey("locations")) {
                    for (String loc : proxyConf.get("locations").split(",")) {
                        String l = loc.trim();
                        if (!l.isEmpty()) proxy.addLocation(l);
                    }
                }
                if (proxyConf.containsKey("host_header_rewrite")) proxy.setHostHeaderRewrite(proxyConf.get("host_header_rewrite"));
                if (proxyConf.containsKey("http_user")) proxy.setHTTPUser(proxyConf.get("http_user"));
                if (proxyConf.containsKey("http_password")) proxy.setHTTPPassword(proxyConf.get("http_password"));
                // remote_port 仅 TCP/UDP
                if (proxyConf.containsKey("remote_port")) proxy.setRemotePort(Integer.parseInt(proxyConf.get("remote_port")));

                cfg.addProxy(proxy);
            }

            // 启动
            Frpandroid.start(cfg);
            running = true;
            currentConfigContent = configContent;
            Log.i(TAG, "frpc started successfully via frp_android");
            return true;

        } catch (Exception e) {
            Log.e(TAG, "Failed to start frpc via frp_android", e);
            running = false;
            return false;
        }
    }

    /**
     * 重新加载配置
     */
    public boolean reload(String configContent) {
        if (!running) {
            return startFrpc(configContent);
        }

        try {
            Map<String, Map<String, String>> sections = parseIni(configContent);
            frpandroid.FrpcConfig cfg = Frpandroid.newFrpcConfig();

            Map<String, String> common = sections.get("common");
            if (common != null) {
                if (common.containsKey("server_addr")) cfg.setServerAddr(common.get("server_addr"));
                if (common.containsKey("server_port")) cfg.setServerPort(Integer.parseInt(common.get("server_port")));
                if (common.containsKey("token")) cfg.setAuthToken(common.get("token"));
                if (common.containsKey("user")) cfg.setUser(common.get("user"));
                if (common.containsKey("tls_enable")) cfg.setTransportTLSEnable("true".equalsIgnoreCase(common.get("tls_enable")));
                if (common.containsKey("protocol")) cfg.setTransportProtocol(common.get("protocol"));
                if (common.containsKey("tcp_mux")) cfg.setTransportTCPMux("true".equalsIgnoreCase(common.get("tcp_mux")));
                if (common.containsKey("auth_method")) cfg.setAuthMethod(common.get("auth_method"));
                if (common.containsKey("log_file")) cfg.setLogTo(common.get("log_file"));
                if (common.containsKey("log_level")) cfg.setLogLevel(common.get("log_level"));
                if (common.containsKey("log_max_days")) cfg.setLogMaxDays(Long.parseLong(common.get("log_max_days")));
                if (common.containsKey("login_fail_exit")) cfg.setLoginFailExit("true".equalsIgnoreCase(common.get("login_fail_exit")));
            }

            for (Map.Entry<String, Map<String, String>> entry : sections.entrySet()) {
                String sectionName = entry.getKey();
                if ("common".equals(sectionName)) continue;
                Map<String, String> proxyConf = entry.getValue();
                String type = proxyConf.getOrDefault("type", "tcp");
                frpandroid.FrpcProxyConfig proxy = Frpandroid.newFrpcProxyConfig(type);
                if (proxy == null) continue;
                proxy.setName(sectionName);
                if (proxyConf.containsKey("local_ip")) proxy.setLocalIP(proxyConf.get("local_ip"));
                if (proxyConf.containsKey("local_port")) proxy.setLocalPort(Integer.parseInt(proxyConf.get("local_port")));
                if (proxyConf.containsKey("use_encryption")) proxy.setUseEncryption("true".equalsIgnoreCase(proxyConf.get("use_encryption")));
                if (proxyConf.containsKey("use_compression")) proxy.setUseCompression("true".equalsIgnoreCase(proxyConf.get("use_compression")));
                if (proxyConf.containsKey("custom_domains")) {
                    for (String domain : proxyConf.get("custom_domains").split(",")) {
                        String d = domain.trim();
                        if (!d.isEmpty()) proxy.addCustomDomain(d);
                    }
                }
                if (proxyConf.containsKey("subdomain")) proxy.setSubDomain(proxyConf.get("subdomain"));
                if (proxyConf.containsKey("locations")) {
                    for (String loc : proxyConf.get("locations").split(",")) {
                        String l = loc.trim();
                        if (!l.isEmpty()) proxy.addLocation(l);
                    }
                }
                if (proxyConf.containsKey("host_header_rewrite")) proxy.setHostHeaderRewrite(proxyConf.get("host_header_rewrite"));
                if (proxyConf.containsKey("http_user")) proxy.setHTTPUser(proxyConf.get("http_user"));
                if (proxyConf.containsKey("http_password")) proxy.setHTTPPassword(proxyConf.get("http_password"));
                if (proxyConf.containsKey("remote_port")) proxy.setRemotePort(Integer.parseInt(proxyConf.get("remote_port")));
                cfg.addProxy(proxy);
            }

            Frpandroid.reload(cfg);
            currentConfigContent = configContent;
            Log.i(TAG, "frpc reloaded successfully");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to reload frpc", e);
            return false;
        }
    }

    /**
     * 停止 frpc
     */
    public void stopFrpc() {
        try {
            Frpandroid.stop();
        } catch (Exception e) {
            Log.w(TAG, "Error stopping frpc", e);
        }
        running = false;
        currentConfigContent = null;
        Log.i(TAG, "frpc stopped");
    }

    public boolean isRunning() {
        return running;
    }

    /**
     * 解析 INI 格式文本为 Map<sectionName, Map<key, value>>
     */
    private Map<String, Map<String, String>> parseIni(String content) {
        Map<String, Map<String, String>> result = new HashMap<>();
        if (content == null || content.trim().isEmpty()) return result;

        String currentSection = "common"; // 默认段
        Map<String, String> currentMap = new HashMap<>();
        result.put(currentSection, currentMap);

        Pattern sectionPattern = Pattern.compile("^\\s*\\[([^\\]]+)\\]\\s*$");
        Pattern kvPattern = Pattern.compile("^\\s*([^=#;\\s]+)\\s*=\\s*(.*?)\\s*$");

        for (String line : content.split("\\r?\\n")) {
            // 跳过空行和注释
            String trimmed = line.trim();
            if (trimmed.isEmpty() || trimmed.startsWith("#") || trimmed.startsWith(";")) {
                continue;
            }

            // 检查是否是段标题
            Matcher sectionMatcher = sectionPattern.matcher(line);
            if (sectionMatcher.matches()) {
                currentSection = sectionMatcher.group(1).trim();
                currentMap = result.get(currentSection);
                if (currentMap == null) {
                    currentMap = new HashMap<>();
                    result.put(currentSection, currentMap);
                }
                continue;
            }

            // 检查是否是键值对
            Matcher kvMatcher = kvPattern.matcher(line);
            if (kvMatcher.matches()) {
                currentMap.put(kvMatcher.group(1).trim(), kvMatcher.group(2).trim());
            }
        }

        return result;
    }

    /**
     * 从 frpc.ini 配置内容中提取 local_port
     */
    public static int extractLocalPort(String configContent) {
        if (configContent == null) return -1;
        Pattern p = Pattern.compile("local_port\\s*=\\s*(\\d+)");
        Matcher m = p.matcher(configContent);
        if (m.find()) {
            try { return Integer.parseInt(m.group(1)); } catch (NumberFormatException e) { return -1; }
        }
        return -1;
    }

    /**
     * 校验 frpc 配置中的 local_port 是否与服务器端口一致
     * @return null 表示一致，否则返回错误信息
     */
    public static String validatePort(String configContent, int serverPort) {
        int frpcPort = extractLocalPort(configContent);
        if (frpcPort == -1) {
            return "frpc 配置中未找到 local_port，请检查配置";
        }
        if (frpcPort != serverPort) {
            return "端口不匹配！frpc local_port=" + frpcPort + "，服务器端口=" + serverPort + "，请修改一致";
        }
        return null;
    }
}