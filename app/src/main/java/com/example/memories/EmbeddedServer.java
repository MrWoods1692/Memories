package com.example.memories;

import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Environment;
import android.os.StatFs;
import android.util.Log;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoHTTPD.IHTTPSession;
import fi.iki.elonen.NanoHTTPD.Response;
import fi.iki.elonen.NanoHTTPD.Response.Status;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.RandomAccessFile;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.Enumeration;
import java.util.Locale;
import java.util.Map;

import org.json.JSONObject;

public class EmbeddedServer extends NanoHTTPD {
    private static final String TAG = "EmbeddedServer";
    private final Context context;
    private final long startTime;

    // 网速计算
    private long lastRxBytes = 0;
    private long lastTxBytes = 0;
    private long lastNetCheck = 0;

    public EmbeddedServer(int port, Context ctx) {
        super(port);
        this.context = ctx.getApplicationContext();
        this.startTime = System.currentTimeMillis();
    }

    /**
     * 判断请求是否来自局域网 (10.x, 172.16-31.x, 192.168.x, 127.x)
     */
    private boolean isLanRequest(IHTTPSession session) {
        try {
            String ip = session.getRemoteIpAddress();
            if (ip == null) return false;
            // IPv6 localhost
            if (ip.equals("0:0:0:0:0:0:0:1") || ip.equals("::1")) return true;
            InetAddress addr = InetAddress.getByName(ip);
            if (addr.isLoopbackAddress()) return true;
            if (addr.isSiteLocalAddress()) return true;
            if (addr.isLinkLocalAddress()) return true;
            // 额外检查 10.x 和 172.16-31.x (某些 JVM 不视为 site-local)
            byte[] octets = addr.getAddress();
            if (octets.length == 4) {
                int first = octets[0] & 0xFF;
                int second = octets[1] & 0xFF;
                if (first == 10) return true;
                if (first == 172 && second >= 16 && second <= 31) return true;
                if (first == 192 && second == 168) return true;
                if (first == 127) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 检查是否为管理员：局域网自动授权，公网通过 x-user-qq header 检查 role >= 2
     */
    private boolean isAdmin(IHTTPSession session, DatabaseHelper db) {
        if (isLanRequest(session)) return true;
        String qq = session.getHeaders().get("x-user-qq");
        return db.getUserRole(qq) >= 2;
    }

    /**
     * 获取设备当前局域网 IPv4 地址，失败返回 "127.0.0.1"
     */
    public static String getLanIpAddress() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces.hasMoreElements()) {
                NetworkInterface ni = interfaces.nextElement();
                if (ni.isLoopback() || !ni.isUp()) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr instanceof Inet4Address && !addr.isLoopbackAddress()) {
                        String ip = addr.getHostAddress();
                        if (ip != null && !ip.startsWith("169.254")) {
                            return ip;
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return "127.0.0.1";
    }

    @Override
    public Response serve(IHTTPSession session) {
        Method method = session.getMethod();
        String uri = session.getUri();
        Log.i(TAG, "CORS check: method=" + method + " uri=" + uri);

        // CORS 预检请求：兼容 method 为 null 的情况（frp/nginx 代理可能丢失 method）
        if (Method.OPTIONS.equals(method) || (method == null && "OPTIONS".equalsIgnoreCase(
                session.getHeaders().getOrDefault("access-control-request-method", "")))) {
            Log.i(TAG, "Handling CORS preflight: " + uri);
            Response r = NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "");
            addCorsHeaders(r);
            return r;
        }
        Response response = doServe(session);
        addCorsHeaders(response);
        return response;
    }

    private Response doServe(IHTTPSession session) {
        String uri = session.getUri();
        Log.i(TAG, "Request: " + uri + " method=" + session.getMethod());

        try {
            if ("/health".equals(uri)) {
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "OK");
            }

            if (uri.startsWith("/images")) {
                return handleImages(session);
            }

            if (uri.equals("/backup") && Method.POST.equals(session.getMethod())) {
                // 已改为自动同步，保留端点兼容但提示
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "已启用自动同步，每次写入自动备份到 WebDAV");
            }

            if (uri.equals("/config")) {
                if (Method.GET.equals(session.getMethod())) return handleGetConfig(session);
                if (Method.POST.equals(session.getMethod())) return handleSetConfig(session);
            }

            if (uri.equals("/status") && Method.GET.equals(session.getMethod())) {
                return handleStatus(session);
            }

            if (uri.equals("/sysinfo") && Method.GET.equals(session.getMethod())) {
                return handleSysInfo(session);
            }

            if (uri.startsWith("/bans")) {
                return handleBans(session);
            }

            if (uri.startsWith("/users")) {
                return handleUsers(session);
            }

            if (uri.equals("/webdav/config") && Method.GET.equals(session.getMethod())) {
                return handleWebdavConfig(session);
            }

            if (uri.equals("/platform") && Method.GET.equals(session.getMethod())) {
                return handlePlatform(session);
            }

            if (uri.startsWith("/frpc")) {
                return handleFrpc(session);
            }

            if (uri.startsWith("/oauth")) {
                return handleOauth(session);
            }

            if (uri.startsWith("/db")) {
                return handleDatabase(session);
            }

            return NanoHTTPD.newFixedLengthResponse(Status.NOT_FOUND, "text/plain", "Not Found");
        } catch (Exception e) {
            Log.e(TAG, "Serve error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "Error");
        }
    }

    /**
     * 为响应添加 CORS 跨域头，允许管理面板跨端口/跨域调用 API
     */
    private void addCorsHeaders(Response response) {
        response.addHeader("Access-Control-Allow-Origin", "*");
        response.addHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH");
        response.addHeader("Access-Control-Allow-Headers",
                "Content-Type, x-user-qq, Authorization, authorization, DNT, User-Agent, X-Requested-With, If-Modified-Since, Cache-Control, Range");
        response.addHeader("Access-Control-Max-Age", "86400");
        response.addHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range");
    }

    private Response handleImages(IHTTPSession session) {
        String uri = session.getUri();
        Method method = session.getMethod();
        DatabaseHelper db = new DatabaseHelper(context);

        try {
            if ("/images".equals(uri) && Method.GET.equals(method)) {
                // 分页参数：page（页码，默认1），limit（每页条数，默认20），status（默认只返回审核通过）
                Map<String, String> params = session.getParms();
                int page = 1;
                int limit = 20;
                boolean allStatus = false;
                try {
                    String pageStr = params.get("page");
                    if (pageStr != null && !pageStr.isEmpty()) page = Integer.parseInt(pageStr);
                    String limitStr = params.get("limit");
                    if (limitStr != null && !limitStr.isEmpty()) limit = Integer.parseInt(limitStr);
                    // status=all 时返回全部状态图片，需要审核身份
                    String statusStr = params.get("status");
                    if ("all".equals(statusStr)) {
                        allStatus = true;
                    }
                } catch (NumberFormatException ignored) {}

                // 如果需要全部状态图片，检查审核权限（局域网 或 审核员 role>=1）
                if (allStatus) {
                    String qq = session.getHeaders().get("x-user-qq");
                    int role = db.getUserRole(qq);
                    if (!isLanRequest(session) && role < 1) {
                        return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "reviewer required");
                    }
                }

                String json = db.listImagesPaginatedJson(page, limit, allStatus);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            if ("/images".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String url = params.get("url");
                if (url == null || url.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing url");
                }
                long id = db.addImage(url);

                // 自动同步到 WebDAV（后台线程，不阻塞响应）
                autoSyncToWebdav();

                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", "{\"id\":"+id+"}");
            }

            // DELETE /images/cleanup - 批量清理已拒绝图片（仅管理员）
            if ("/images/cleanup".equals(uri) && Method.DELETE.equals(method)) {
                if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                int deleted = db.cleanupRejectedImages();
                JSONObject result = new JSONObject();
                try {
                    result.put("deleted", deleted);
                    result.put("message", "已清理 " + deleted + " 条已拒绝记录");
                } catch (Exception ignored) {}
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", result.toString());
            }

            // /images/{id}
            String[] parts = uri.split("/");
            if (parts.length >= 3) {
                String idStr = parts[2];
                long id = Long.parseLong(idStr);
                if (Method.DELETE.equals(method)) {
                    if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                    boolean ok = db.deleteImage(id);
                    return NanoHTTPD.newFixedLengthResponse(ok?Status.OK:Status.NOT_FOUND, "text/plain", ok?"deleted":"not found");
                }

                if (parts.length >= 4 && "audit".equals(parts[3]) && Method.POST.equals(method)) {
                    String qq = session.getHeaders().get("x-user-qq");
                    int role = db.getUserRole(qq);
                    if (!isLanRequest(session) && role < 1) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "reviewer required");
                    Map<String, String> files = new java.util.HashMap<>();
                    session.parseBody(files);
                    Map<String, String> params = session.getParms();
                    String statusStr = params.get("status");
                    int status = Integer.parseInt(statusStr == null ? "0" : statusStr);
                    // 拒绝时自动删除：检查 auto_cleanup_rejected 配置（默认开启）
                    if (status == 2) {
                        String autoCleanup = db.getConfig("auto_cleanup_rejected");
                        if (autoCleanup == null || "true".equals(autoCleanup)) {
                            boolean deleted = db.deleteImage(id);
                            return NanoHTTPD.newFixedLengthResponse(deleted ? Status.OK : Status.NOT_FOUND, "text/plain", "deleted");
                        }
                    }
                    boolean ok = db.updateImageStatus(id, status);
                    return NanoHTTPD.newFixedLengthResponse(ok?Status.OK:Status.NOT_FOUND, "text/plain", ok?"updated":"not found");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "handleImages error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    /**
     * 后台线程自动同步数据库到 WebDAV（覆盖式，固定文件名 memories.db）
     */
    private void autoSyncToWebdav() {
        new Thread(() -> {
            try {
                DatabaseHelper db = new DatabaseHelper(context);
                String cfg = db.getConfigJson();
                JSONObject o = new JSONObject(cfg);
                String webdavUrl = o.optString("webdav_url", null);
                if (webdavUrl == null || webdavUrl.isEmpty()) return;
                String webdavUser = o.optString("webdav_user", null);
                String webdavPass = o.optString("webdav_pass", null);

                String dbPath = db.getDatabasePathString();
                java.io.File f = new java.io.File(dbPath);
                boolean ok = WebDavBackup.uploadFile(webdavUrl, webdavUser, webdavPass, f, "memories.db");
                Log.i(TAG, ok ? "WebDAV auto-sync OK" : "WebDAV auto-sync FAILED");
            } catch (Exception e) {
                Log.e(TAG, "WebDAV auto-sync error", e);
            }
        }).start();
    }

    private Response handleGetConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String json = db.getConfigJson();
        return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
    }

    private Response handleSetConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
        try {
            Map<String,String> files = new java.util.HashMap<>();
            session.parseBody(files);
            Map<String,String> params = session.getParms();
            String k = params.get("k");
            String v = params.get("v");
            if (k==null) return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing k");
            db.setConfig(k, v==null?"":v);
            return NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "ok");
        } catch (Exception e) {
            Log.e(TAG, "setConfig error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    private Response handleStatus(IHTTPSession session) {
        try {
            DatabaseHelper db = new DatabaseHelper(context);
            JSONObject o = new JSONObject();
            o.put("db_path", db.getDatabasePathString());
            o.put("image_count", db.getImageCount());
            o.put("uptime", System.currentTimeMillis() - startTime);
            return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "status error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    private Response handleSysInfo(IHTTPSession session) {
        try {
            JSONObject o = new JSONObject();

            // --- 磁盘信息 ---
            File dataDir = Environment.getDataDirectory();
            StatFs statFs = new StatFs(dataDir.getPath());
            long blockSize = statFs.getBlockSizeLong();
            long totalBlocks = statFs.getBlockCountLong();
            long freeBlocks = statFs.getAvailableBlocksLong();
            long totalBytes = blockSize * totalBlocks;
            long freeBytes = blockSize * freeBlocks;
            long usedBytes = totalBytes - freeBytes;

            JSONObject disk = new JSONObject();
            disk.put("total", totalBytes);
            disk.put("free", freeBytes);
            disk.put("used", usedBytes);
            o.put("disk", disk);

            // --- 数据大小 ---
            DatabaseHelper db = new DatabaseHelper(context);
            File dbFile = new File(db.getDatabasePathString());
            long dbSize = dbFile.exists() ? dbFile.length() : 0;
            o.put("db_size", dbSize);

            // --- 运行时间 ---
            long uptime = System.currentTimeMillis() - startTime;
            o.put("uptime", uptime);

            // --- CPU 信息 ---
            int cores = Runtime.getRuntime().availableProcessors();
            JSONObject cpu = new JSONObject();
            cpu.put("cores", cores);
            cpu.put("arch", System.getProperty("os.arch", "unknown"));

            // 详细解析 /proc/cpuinfo
            String cpuModel = "unknown";
            String cpuImplementer = "";
            String cpuArch = "";
            String cpuVariant = "";
            String cpuPart = "";
            String cpuRevision = "";
            String cpuFeatures = "";
            double bogoMips = 0;
            try {
                BufferedReader br = new BufferedReader(new java.io.FileReader("/proc/cpuinfo"));
                String line;
                while ((line = br.readLine()) != null) {
                    String[] parts = line.split(":");
                    if (parts.length < 2) continue;
                    String key = parts[0].trim();
                    String val = parts[1].trim();
                    if (key.equals("Hardware") || key.equals("model name")) {
                        cpuModel = val;
                    } else if (key.equals("CPU implementer")) {
                        cpuImplementer = val;
                    } else if (key.equals("CPU architecture")) {
                        cpuArch = val;
                    } else if (key.equals("CPU variant")) {
                        cpuVariant = val;
                    } else if (key.equals("CPU part")) {
                        cpuPart = val;
                    } else if (key.equals("CPU revision")) {
                        cpuRevision = val;
                    } else if (key.equals("Features") && cpuFeatures.isEmpty()) {
                        cpuFeatures = val;
                    } else if (key.equals("BogoMIPS") && bogoMips == 0) {
                        try { bogoMips = Double.parseDouble(val); } catch (Exception ignored) {}
                    }
                }
                br.close();
            } catch (Exception ignored) {}
            cpu.put("model", cpuModel);
            cpu.put("implementer", cpuImplementer);
            cpu.put("cpu_arch", cpuArch);
            cpu.put("variant", cpuVariant);
            cpu.put("part", cpuPart);
            cpu.put("revision", cpuRevision);
            cpu.put("features", cpuFeatures);
            cpu.put("bogomips", bogoMips);

            // 读取 CPU governor 和频率 (尝试所有核心)
            JSONObject freq = new JSONObject();
            try {
                for (int i = 0; i < Math.min(cores, 8); i++) {
                    String cpuPath = "/sys/devices/system/cpu/cpu" + i + "/cpufreq/";
                    JSONObject coreInfo = new JSONObject();
                    try {
                        String gov = readFirstLine(cpuPath + "scaling_governor");
                        if (gov != null) coreInfo.put("governor", gov);
                        String curFreq = readFirstLine(cpuPath + "scaling_cur_freq");
                        if (curFreq != null) coreInfo.put("cur_khz", Long.parseLong(curFreq.trim()));
                        String maxFreq = readFirstLine(cpuPath + "scaling_max_freq");
                        if (maxFreq != null) coreInfo.put("max_khz", Long.parseLong(maxFreq.trim()));
                        String minFreq = readFirstLine(cpuPath + "cpuinfo_max_freq");
                        if (minFreq == null) minFreq = readFirstLine(cpuPath + "scaling_min_freq");
                        if (minFreq != null) coreInfo.put("min_khz", Long.parseLong(minFreq.trim()));
                    } catch (Exception ignored) {}
                    if (coreInfo.length() > 0) freq.put("core" + i, coreInfo);
                }
            } catch (Exception ignored) {}
            cpu.put("frequencies", freq);

            // CPU 负载
            JSONObject load = new JSONObject();
            try {
                String loadAvg = readFirstLine("/proc/loadavg");
                if (loadAvg != null) {
                    String[] parts = loadAvg.split("\\s+");
                    if (parts.length >= 3) {
                        load.put("avg1", Double.parseDouble(parts[0]));
                        load.put("avg5", Double.parseDouble(parts[1]));
                        load.put("avg15", Double.parseDouble(parts[2]));
                        // 运行/总进程数
                        if (parts.length >= 4) {
                            String[] procParts = parts[3].split("/");
                            if (procParts.length >= 2) {
                                load.put("running", Integer.parseInt(procParts[0]));
                                load.put("total_procs", Integer.parseInt(procParts[1]));
                            }
                        }
                    }
                }
            } catch (Exception ignored) {}
            cpu.put("load", load);

            o.put("cpu", cpu);

            // --- 内存信息 ---
            JSONObject memory = new JSONObject();
            Runtime rt = Runtime.getRuntime();
            long maxMem = rt.maxMemory();    // JVM 最大内存
            long totalMem = rt.totalMemory(); // JVM 已分配
            long freeMem = rt.freeMemory();   // JVM 空闲
            memory.put("jvm_max", maxMem);
            memory.put("jvm_allocated", totalMem);
            memory.put("jvm_free", freeMem);

            // 系统内存 (通过 /proc/meminfo)
            try {
                BufferedReader br = new BufferedReader(new java.io.FileReader("/proc/meminfo"));
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.startsWith("MemTotal:")) {
                        memory.put("sys_total", parseKb(line) * 1024);
                    } else if (line.startsWith("MemAvailable:")) {
                        memory.put("sys_available", parseKb(line) * 1024);
                        break;
                    }
                }
                br.close();
            } catch (Exception e) {
                memory.put("sys_total", 0);
                memory.put("sys_available", 0);
            }
            o.put("memory", memory);

            // --- 网络信息 ---
            JSONObject network = new JSONObject();
            network.put("lan_ip", getLanIpAddress());
            // WiFi SSID
            try {
                android.net.wifi.WifiManager wifiMgr = (android.net.wifi.WifiManager)
                    context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
                if (wifiMgr != null && wifiMgr.getConnectionInfo() != null) {
                    String ssid = wifiMgr.getConnectionInfo().getSSID();
                    if (ssid != null && !ssid.equals("<unknown ssid>")) {
                        network.put("wifi_ssid", ssid.replace("\"", ""));
                    }
                }
            } catch (Exception ignored) {}

            // DNS 服务器
            try {
                JSONObject dns = new JSONObject();
                // Android: getprop net.dns1, net.dns2
                String dns1 = getSystemProperty("net.dns1");
                String dns2 = getSystemProperty("net.dns2");
                if (dns1 != null && !dns1.isEmpty()) dns.put("dns1", dns1);
                if (dns2 != null && !dns2.isEmpty()) dns.put("dns2", dns2);
                if (dns1 == null) {
                    // Fallback: read /etc/resolv.conf
                    try {
                        BufferedReader br = new BufferedReader(new java.io.FileReader("/etc/resolv.conf"));
                        String line;
                        int idx = 1;
                        while ((line = br.readLine()) != null && idx <= 2) {
                            if (line.startsWith("nameserver")) {
                                String[] parts = line.split("\\s+");
                                if (parts.length >= 2) {
                                    dns.put("dns" + idx, parts[1]);
                                    idx++;
                                }
                            }
                        }
                        br.close();
                    } catch (Exception ignored) {}
                }
                network.put("dns", dns);
            } catch (Exception ignored) {}

            // 实时网速 + 累计流量统计
            try {
                long[] rxTx = readNetworkBytes();
                long rx = rxTx[0];
                long tx = rxTx[1];
                network.put("rx_bytes", rx);
                network.put("tx_bytes", tx);

                // 累计流量（持久化到数据库）
                long prevRx = parseLong(db.getConfig("total_rx"), 0);
                long prevTx = parseLong(db.getConfig("total_tx"), 0);
                // 如果本次读取值比上次小，说明计数器重置了（重启），累加差值
                if (rx >= prevRx) {
                    db.setConfig("total_rx", String.valueOf(rx));
                } else {
                    // 计数器回绕/重置：保存之前累计 + 当前值
                    long baseRx = parseLong(db.getConfig("total_rx_base"), 0);
                    db.setConfig("total_rx_base", String.valueOf(baseRx + prevRx));
                    db.setConfig("total_rx", String.valueOf(rx));
                }
                if (tx >= prevTx) {
                    db.setConfig("total_tx", String.valueOf(tx));
                } else {
                    long baseTx = parseLong(db.getConfig("total_tx_base"), 0);
                    db.setConfig("total_tx_base", String.valueOf(baseTx + prevTx));
                    db.setConfig("total_tx", String.valueOf(tx));
                }
                long totalRx = parseLong(db.getConfig("total_rx_base"), 0) + rx;
                long totalTx = parseLong(db.getConfig("total_tx_base"), 0) + tx;
                network.put("total_rx", totalRx);
                network.put("total_tx", totalTx);

                // 计算速率
                long now = System.currentTimeMillis();
                if (lastNetCheck > 0 && now > lastNetCheck) {
                    double elapsedSec = (now - lastNetCheck) / 1000.0;
                    if (elapsedSec > 0) {
                        network.put("rx_speed", (long)((rx - lastRxBytes) / elapsedSec));
                        network.put("tx_speed", (long)((tx - lastTxBytes) / elapsedSec));
                    }
                }
                lastRxBytes = rx;
                lastTxBytes = tx;
                lastNetCheck = now;
            } catch (Exception ignored) {}
            o.put("network", network);

            // --- 硬件信息 ---
            JSONObject hardware = new JSONObject();
            // 系统内存总量
            try {
                BufferedReader br = new BufferedReader(new java.io.FileReader("/proc/meminfo"));
                String line;
                while ((line = br.readLine()) != null) {
                    if (line.startsWith("MemTotal:")) {
                        hardware.put("mem_total", parseKb(line) * 1024);
                        break;
                    }
                }
                br.close();
            } catch (Exception ignored) {}
            // 存储类型 (从 /sys/block 判断)
            try {
                java.io.File mmcDir = new java.io.File("/sys/block/mmcblk0");
                hardware.put("storage_type", mmcDir.exists() ? "eMMC" : "UFS/Other");
            } catch (Exception ignored) {}
            // SOC / 芯片平台
            hardware.put("soc", cpuModel.isEmpty() ? "unknown" : cpuModel);
            o.put("hardware", hardware);

            // --- 电池 & UPS 信息 ---
            JSONObject battery = new JSONObject();
            try {
                IntentFilter ifilter = new IntentFilter(Intent.ACTION_BATTERY_CHANGED);
                Intent batteryStatus = context.registerReceiver(null, ifilter);
                if (batteryStatus != null) {
                    int level = batteryStatus.getIntExtra(BatteryManager.EXTRA_LEVEL, -1);
                    int scale = batteryStatus.getIntExtra(BatteryManager.EXTRA_SCALE, 100);
                    int pct = scale > 0 ? (level * 100 / scale) : -1;
                    battery.put("level", pct);

                    int status = batteryStatus.getIntExtra(BatteryManager.EXTRA_STATUS, -1);
                    String statusText;
                    boolean charging;
                    switch (status) {
                        case BatteryManager.BATTERY_STATUS_CHARGING: statusText = "充电中"; charging = true; break;
                        case BatteryManager.BATTERY_STATUS_DISCHARGING: statusText = "放电中"; charging = false; break;
                        case BatteryManager.BATTERY_STATUS_FULL: statusText = "已充满"; charging = true; break;
                        case BatteryManager.BATTERY_STATUS_NOT_CHARGING: statusText = "未充电"; charging = false; break;
                        default: statusText = "未知"; charging = false; break;
                    }
                    battery.put("status", statusText);
                    battery.put("charging", charging);

                    int plugged = batteryStatus.getIntExtra(BatteryManager.EXTRA_PLUGGED, -1);
                    String powerSource;
                    switch (plugged) {
                        case BatteryManager.BATTERY_PLUGGED_AC: powerSource = "交流电"; break;
                        case BatteryManager.BATTERY_PLUGGED_USB: powerSource = "USB"; break;
                        case BatteryManager.BATTERY_PLUGGED_WIRELESS: powerSource = "无线充电"; break;
                        default: powerSource = "电池供电"; break;
                    }
                    battery.put("power_source", powerSource);

                    // 温度 (0.1°C 单位)
                    int temp = batteryStatus.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0);
                    battery.put("temperature", temp / 10.0);

                    // 电压 (mV)
                    int voltage = batteryStatus.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0);
                    battery.put("voltage", voltage / 1000.0);

                    // 健康状态
                    int health = batteryStatus.getIntExtra(BatteryManager.EXTRA_HEALTH, -1);
                    String healthText;
                    switch (health) {
                        case BatteryManager.BATTERY_HEALTH_GOOD: healthText = "良好"; break;
                        case BatteryManager.BATTERY_HEALTH_OVERHEAT: healthText = "过热"; break;
                        case BatteryManager.BATTERY_HEALTH_DEAD: healthText = "损坏"; break;
                        case BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE: healthText = "过压"; break;
                        case BatteryManager.BATTERY_HEALTH_COLD: healthText = "过冷"; break;
                        default: healthText = "未知"; break;
                    }
                    battery.put("health", healthText);

                    // 技术类型
                    String tech = batteryStatus.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY);
                    battery.put("technology", tech != null ? tech : "未知");
                }
            } catch (Exception e) {
                battery.put("level", -1);
                battery.put("status", "不可用");
                battery.put("charging", false);
                battery.put("power_source", "未知");
                battery.put("temperature", 0);
                battery.put("voltage", 0);
                battery.put("health", "未知");
                battery.put("technology", "未知");
            }
            // 设备信息
            battery.put("device_model", Build.MODEL);
            battery.put("android_version", Build.VERSION.RELEASE);
            o.put("battery", battery);

            return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "sysinfo error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    /** 从 /proc/meminfo 行中提取 KB 数值 */
    private long parseKb(String line) {
        try {
            return Long.parseLong(line.replaceAll("[^0-9]", "").trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private long parseLong(String s, long def) {
        if (s == null) return def;
        try { return Long.parseLong(s); } catch (NumberFormatException e) { return def; }
    }

    /** 读取文件的第一行，失败返回 null */
    private String readFirstLine(String path) {
        try {
            BufferedReader br = new BufferedReader(new java.io.FileReader(path));
            String line = br.readLine();
            br.close();
            return line != null ? line.trim() : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** 从 /proc/net/dev 或 /sys/class/net 读取总接收/发送字节数 */
    private long[] readNetworkBytes() {
        long[] result = new long[]{0, 0};
        // 优先读取 /sys/class/net (更可靠)
        try {
            java.io.File netDir = new java.io.File("/sys/class/net");
            String[] ifaces = netDir.list();
            if (ifaces != null) {
                for (String iface : ifaces) {
                    if ("lo".equals(iface)) continue;
                    try {
                        String rxStr = readFirstLine("/sys/class/net/" + iface + "/statistics/rx_bytes");
                        String txStr = readFirstLine("/sys/class/net/" + iface + "/statistics/tx_bytes");
                        if (rxStr != null) result[0] += Long.parseLong(rxStr.trim());
                        if (txStr != null) result[1] += Long.parseLong(txStr.trim());
                    } catch (Exception ignored) {}
                }
                if (result[0] > 0 || result[1] > 0) return result;
            }
        } catch (Exception e) {
            Log.w(TAG, "readNetworkBytes sysfs failed: " + e.getMessage());
        }
        // Fallback: /proc/net/dev
        try {
            BufferedReader br = new BufferedReader(new java.io.FileReader("/proc/net/dev"));
            String line;
            while ((line = br.readLine()) != null) {
                int colon = line.indexOf(':');
                if (colon < 0) continue;
                String iface = line.substring(0, colon).trim();
                if ("lo".equals(iface)) continue;
                String[] parts = line.substring(colon + 1).trim().split("\\s+");
                if (parts.length >= 10) {
                    result[0] += Long.parseLong(parts[0]);
                    result[1] += Long.parseLong(parts[8]);
                }
            }
            br.close();
        } catch (Exception e) {
            Log.w(TAG, "readNetworkBytes procfs failed: " + e.getMessage());
        }
        return result;
    }

    /** 读取 Android 系统属性 */
    private String getSystemProperty(String key) {
        try {
            Class<?> c = Class.forName("android.os.SystemProperties");
            java.lang.reflect.Method m = c.getMethod("get", String.class);
            return (String) m.invoke(null, key);
        } catch (Exception e) {
            return null;
        }
    }

    private Response handleUsers(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            // GET /users - list all users
            if ("/users".equals(uri) && Method.GET.equals(method)) {
                String json = db.listUsersJson();
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // POST /users - add reviewer (role=1) or admin (role=2)
            if ("/users".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String userQq = params.get("qq");
                String roleStr = params.get("role");
                if (userQq == null || userQq.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing qq");
                }
                int newRole = 1; // default reviewer
                if (roleStr != null) {
                    try { newRole = Integer.parseInt(roleStr); } catch (NumberFormatException ignored) {}
                }
                if (newRole < 1 || newRole > 2) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "role must be 1 (reviewer) or 2 (admin)");
                }
                db.addUser(userQq, newRole);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", "{\"qq\":\""+userQq+"\",\"role\":"+newRole+"}");
            }

            // DELETE /users/{qq} - remove a user
            String[] parts = uri.split("/");
            if (parts.length >= 3 && Method.DELETE.equals(method)) {
                String targetQq = parts[2];
                boolean ok = db.deleteUser(targetQq);
                return NanoHTTPD.newFixedLengthResponse(ok ? Status.OK : Status.NOT_FOUND, "text/plain", ok ? "deleted" : "not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "handleUsers error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // --- 封禁用户管理 ---

    private Response handleBans(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            // GET /bans - 列出所有封禁用户
            if ("/bans".equals(uri) && Method.GET.equals(method)) {
                String json = db.listBannedUsersJson();
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // POST /bans - 封禁用户 (qq, reason)
            if ("/bans".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String targetQq = params.get("qq");
                String reason = params.get("reason");
                if (targetQq == null || targetQq.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing qq");
                }
                db.banUser(targetQq, reason);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", "{\"qq\":\""+targetQq+"\",\"banned\":true}");
            }

            // DELETE /bans/{qq} - 解封用户
            String[] parts = uri.split("/");
            if (parts.length >= 3 && Method.DELETE.equals(method)) {
                String targetQq = parts[2];
                boolean ok = db.unbanUser(targetQq);
                return NanoHTTPD.newFixedLengthResponse(ok ? Status.OK : Status.NOT_FOUND, "text/plain", ok ? "unbanned" : "not found");
            }
        } catch (Exception e) {
            Log.e(TAG, "handleBans error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // --- WebDAV 备份配置获取 ---

    private Response handleWebdavConfig(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        try {
            JSONObject o = new JSONObject();
            o.put("webdav_url", db.getConfig("webdav_url"));
            o.put("webdav_user", db.getConfig("webdav_user"));
            o.put("configured", db.getConfig("webdav_url") != null);
            return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "webdavConfig error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    // --- 平台信息 (logo / 名称) ---

    private Response handlePlatform(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        try {
            JSONObject o = new JSONObject();
            o.put("platform_name", db.getConfig("platform_name"));
            o.put("platform_logo", db.getConfig("platform_logo"));
            return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
        } catch (Exception e) {
            Log.e(TAG, "platform error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }
    }

    // --- FRPC 内网穿透管理 ---

    private Response handleFrpc(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        try {
            // GET /frpc/config - 获取 frpc 配置
            if ("/frpc/config".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                o.put("frpc_config", db.getConfig("frpc_config"));
                o.put("configured", db.getConfig("frpc_config") != null && !db.getConfig("frpc_config").isEmpty());
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // POST /frpc/config - 设置 frpc 配置 (管理员)
            if ("/frpc/config".equals(uri) && Method.POST.equals(method)) {
                if (!isAdmin(session, db)) return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String config = params.get("frpc_config");
                if (config != null) {
                    db.setConfig("frpc_config", config);

                    // 自动应用配置：非空时启动/重载 frpc，空配置时停止 frpc
                    FrpcManager frpc = FrpcManager.getInstance();
                    if (frpc != null) {
                        if (config.trim().isEmpty()) {
                            frpc.stopFrpc();
                            Log.i(TAG, "frpc stopped (empty config)");
                        } else {
                            boolean ok = frpc.reload(config);
                            Log.i(TAG, "frpc " + (ok ? "reloaded" : "start failed") + " after config update");
                        }
                    }
                }
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "ok");
            }

            // GET /frpc/status - 获取 frpc 运行状态
            if ("/frpc/status".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                String cfg = db.getConfig("frpc_config");
                o.put("configured", cfg != null && !cfg.isEmpty());
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "handleFrpc error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    private Response handleOauth(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        try {
            // GET /oauth/config - 获取 OAuth 配置状态
            if ("/oauth/config".equals(uri) && Method.GET.equals(method)) {
                JSONObject o = new JSONObject();
                o.put("configured", db.getConfig("oauth_prefix") != null);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // POST /oauth/config - 管理员配置 OAuth 参数
            if ("/oauth/config".equals(uri) && Method.POST.equals(method)) {
                if (!isAdmin(session, db))
                    return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String prefix = params.get("prefix");
                String clientId = params.get("client_id");
                String clientSecret = params.get("client_secret");
                String redirectUri = params.get("redirect_uri");
                if (prefix != null) db.setConfig("oauth_prefix", prefix);
                if (clientId != null) db.setConfig("oauth_client_id", clientId);
                if (clientSecret != null) db.setConfig("oauth_client_secret", clientSecret);
                if (redirectUri != null) db.setConfig("oauth_redirect_uri", redirectUri);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "text/plain", "ok");
            }

            // GET /oauth/login?redirect=FRONTEND_URL - 浏览器跳转方式发起授权
            if ("/oauth/login".equals(uri) && Method.GET.equals(method)) {
                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String redirectUri = db.getConfig("oauth_redirect_uri");
                if (prefix == null || prefix.isEmpty() || clientId == null || clientId.isEmpty() || redirectUri == null || redirectUri.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }
                Map<String, String> params = session.getParms();
                String frontendRedirect = params.get("redirect");
                String authUrl = OAuthHelper.buildAuthUrl(prefix, clientId, redirectUri, "profile", frontendRedirect, db);
                Response r = NanoHTTPD.newFixedLengthResponse(Status.REDIRECT, "text/html",
                    "<html><body>正在跳转到授权页...<script>location.replace('" + authUrl + "');</script></body></html>");
                r.addHeader("Location", authUrl);
                return r;
            }

            // GET /oauth/start - 发起授权，返回跳转 URL（API 方式）
            // 可选参数 redirect: OAuth 完成后重定向到的前端 URL
            if ("/oauth/start".equals(uri) && Method.GET.equals(method)) {
                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String redirectUri = db.getConfig("oauth_redirect_uri");
                if (prefix == null || prefix.isEmpty() || clientId == null || clientId.isEmpty() || redirectUri == null || redirectUri.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }
                String scope = "profile";
                Map<String, String> params = session.getParms();
                String frontendRedirect = params.get("redirect");
                String authUrl = OAuthHelper.buildAuthUrl(prefix, clientId, redirectUri, scope, frontendRedirect, db);
                JSONObject o = new JSONObject();
                o.put("url", authUrl);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", o.toString());
            }

            // GET /oauth/callback?code=...&state=... - 回调处理
            if ("/oauth/callback".equals(uri) && Method.GET.equals(method)) {
                Map<String, String> params = session.getParms();
                String code = params.get("code");
                String state = params.get("state");
                if (code == null || code.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing code");
                }

                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String clientSecret = db.getConfig("oauth_client_secret");
                String redirectUri = db.getConfig("oauth_redirect_uri");
                if (prefix == null || prefix.isEmpty() || clientId == null || clientId.isEmpty() || clientSecret == null || clientSecret.isEmpty() || redirectUri == null || redirectUri.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }

                // 在 exchangeToken 之前获取前端重定向 URL
                String frontendRedirect = OAuthHelper.getFrontendRedirect(state, db);

                // 换取 token
                JSONObject tokenResp = OAuthHelper.exchangeToken(prefix, clientId, clientSecret, code, redirectUri, state, db);
                if (tokenResp == null || tokenResp.has("error")) {
                    String detail = tokenResp != null ? tokenResp.optString("detail", "unknown") : "no response";
                    return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "token exchange failed: " + detail);
                }

                String accessToken = tokenResp.optString("access_token");
                String refreshToken = tokenResp.optString("refresh_token");
                if (accessToken == null || accessToken.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "no access_token");
                }

                // 获取用户信息
                JSONObject userInfo = OAuthHelper.getUserInfo(prefix, accessToken);
                if (userInfo == null) {
                    return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "userinfo failed");
                }

                String userQq = userInfo.optString("name"); // QQ 号
                String userName = userInfo.optString("username");
                String tenantName = userInfo.optString("tenant_name");

                // 检查该 QQ 是否在审核员/管理员列表中
                int role = db.getUserRole(userQq);

                // 管理面板登录：仅管理员/审核员可访问；其他前端接入：任何用户均可登录
                boolean isAdminLogin = isAdminRedirect(frontendRedirect);
                if (isAdminLogin && role < 1) {
                    if (frontendRedirect != null && !frontendRedirect.isEmpty()) {
                        String sep2 = frontendRedirect.contains("?") ? "&" : "?";
                        String loc2 = frontendRedirect + sep2 + "error=access_denied";
                        Response r2 = NanoHTTPD.newFixedLengthResponse(Status.REDIRECT, "text/html",
                            "<html><body>权限不足，正在跳转...<script>location.replace('" + loc2 + "');</script></body></html>");
                        r2.addHeader("Location", loc2);
                        return r2;
                    }
                    JSONObject err2 = new JSONObject();
                    err2.put("error", "access_denied");
                    err2.put("message", "非管理员或审核员，无权访问管理面板");
                    return NanoHTTPD.newFixedLengthResponse(Status.FORBIDDEN, "application/json", err2.toString());
                }

                JSONObject result = new JSONObject();
                result.put("qq", userQq);
                result.put("username", userName);
                result.put("tenant_name", tenantName);
                result.put("role", role);
                result.put("access_token", accessToken);
                result.put("refresh_token", refreshToken);
                result.put("is_reviewer", role >= 1);
                result.put("is_admin", role >= 2);

                // 如果有前端重定向 URL，则重定向到前端（而非返回 JSON）
                if (frontendRedirect != null && !frontendRedirect.isEmpty()) {
                    String sep = frontendRedirect.contains("?") ? "&" : "?";
                    String loc = frontendRedirect + sep
                        + "token=" + urlEncode(accessToken)
                        + "&qq=" + urlEncode(userQq)
                        + "&role=" + role
                        + "&nickname=" + urlEncode(userName != null ? userName : "");
                    Response r = NanoHTTPD.newFixedLengthResponse(Status.REDIRECT, "text/html",
                        "<html><body>登录成功，正在跳转...<script>location.replace('" + loc + "');</script></body></html>");
                    r.addHeader("Location", loc);
                    return r;
                }

                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", result.toString());
            }

            // POST /oauth/refresh - 刷新 token
            if ("/oauth/refresh".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String refreshToken = params.get("refresh_token");
                if (refreshToken == null || refreshToken.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing refresh_token");
                }
                String prefix = db.getConfig("oauth_prefix");
                String clientId = db.getConfig("oauth_client_id");
                String clientSecret = db.getConfig("oauth_client_secret");
                if (prefix == null || prefix.isEmpty() || clientId == null || clientId.isEmpty() || clientSecret == null || clientSecret.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "oauth not configured");
                }
                JSONObject tokenResp = OAuthHelper.refreshToken(prefix, clientId, clientSecret, refreshToken);
                if (tokenResp == null) {
                    return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "refresh failed");
                }
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", tokenResp.toString());
            }
        } catch (Exception e) {
            Log.e(TAG, "handleOauth error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    // ==================== 数据库可视化管理 ====================

    private Response handleDatabase(IHTTPSession session) {
        DatabaseHelper db = new DatabaseHelper(context);
        String uri = session.getUri();
        Method method = session.getMethod();

        if (!isAdmin(session, db))
            return NanoHTTPD.newFixedLengthResponse(Status.UNAUTHORIZED, "text/plain", "admin required");

        try {
            // GET /db/tables - 列出所有表
            if ("/db/tables".equals(uri) && Method.GET.equals(method)) {
                String json = db.listTablesJson();
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // GET /db/table/{name}?page=1&limit=50 - 分页查询表数据
            if (uri.startsWith("/db/table/") && Method.GET.equals(method)) {
                String tableName = uri.substring("/db/table/".length());
                if (tableName.isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing table name");
                }

                Map<String, String> params = session.getParms();
                int page = 1;
                int limit = 50;
                try {
                    String pageStr = params.get("page");
                    if (pageStr != null && !pageStr.isEmpty()) page = Integer.parseInt(pageStr);
                    String limitStr = params.get("limit");
                    if (limitStr != null && !limitStr.isEmpty()) limit = Integer.parseInt(limitStr);
                } catch (NumberFormatException ignored) {}

                String json = db.queryTableJson(tableName, page, limit);
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }

            // POST /db/query - 执行 SQL 语句（支持读写）
            if ("/db/query".equals(uri) && Method.POST.equals(method)) {
                Map<String, String> files = new java.util.HashMap<>();
                session.parseBody(files);
                Map<String, String> params = session.getParms();
                String sql = params.get("sql");
                if (sql == null || sql.trim().isEmpty()) {
                    return NanoHTTPD.newFixedLengthResponse(Status.BAD_REQUEST, "text/plain", "missing sql");
                }
                String json = db.executeSql(sql.trim());
                return NanoHTTPD.newFixedLengthResponse(Status.OK, "application/json", json);
            }
        } catch (Exception e) {
            Log.e(TAG, "handleDatabase error", e);
            return NanoHTTPD.newFixedLengthResponse(Status.INTERNAL_ERROR, "text/plain", "error");
        }

        return NanoHTTPD.newFixedLengthResponse(Status.NOT_IMPLEMENTED, "text/plain", "Not Implemented");
    }

    /**
     * 判断前端重定向 URL 是否为管理面板（域名以 admin 开头）
     */
    private static boolean isAdminRedirect(String redirectUrl) {
        if (redirectUrl == null || redirectUrl.isEmpty()) return false;
        try {
            if (redirectUrl.startsWith("http://") || redirectUrl.startsWith("https://")) {
                java.net.URL url = new java.net.URL(redirectUrl);
                String host = url.getHost();
                return host.startsWith("admin") || host.startsWith("admin.");
            }
            return redirectUrl.startsWith("/admin");
        } catch (Exception e) {
            return false;
        }
    }

    private static String urlEncode(String s) {
        try {
            return java.net.URLEncoder.encode(s, "UTF-8");
        } catch (Exception e) {
            return s;
        }
    }
}
