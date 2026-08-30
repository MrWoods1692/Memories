import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Card, Col, Row, Space, Spin, Tag } from "antd";
import {
  ApiOutlined, CloudServerOutlined, DatabaseOutlined, DesktopOutlined, FieldTimeOutlined,
  HddOutlined, ReloadOutlined, ThunderboltFilled,
} from "@ant-design/icons";
import { useTheme } from "@/contexts/ThemeContext";
import { theme } from "antd";
import { fetchServerStatus, fetchSysInfo } from "@/api/admin";
import type { ServerStatus, SysInfo } from "@/types/sysinfo";

/** 字节数转可读单位（与内嵌管理面板口径一致） */
function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** 毫秒级运行时长转「X天 X小时 / X小时 X分 / X分 X秒」 */
function fmtUptime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "0秒";
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (hours >= 24) return `${Math.floor(hours / 24)}天 ${hours % 24}小时`;
  if (hours > 0) return `${hours}小时 ${mins}分`;
  if (mins > 0) return `${mins}分 ${secs}秒`;
  return `${secs}秒`;
}

/** 百分比（0-100），总数为 0 时避免除零 */
function pct(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((used / total) * 100)));
}

/** 指标卡：图标 + 标题 + 主读数 + 可选进度条 + 辅助说明 */
function MetricCard({
  icon, title, value, suffix, sub, progress,
}: {
  icon: ReactNode;
  title: string;
  value: ReactNode;
  suffix?: string;
  sub?: ReactNode;
  progress?: number;
}) {
  const { token } = theme.useToken();
  const { accentColor } = useTheme();
  return (
    <Card size="small" styles={{ body: { padding: "14px 16px" } }} style={{ borderRadius: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ color: accentColor, fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 13, color: token.colorTextSecondary, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2, color: token.colorText }}>
        {value}{suffix ? <span style={{ fontSize: 13, fontWeight: 500, marginLeft: 6, color: token.colorTextSecondary }}>{suffix}</span> : null}
      </div>
      {progress !== undefined && (
        <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: token.colorFillSecondary, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: accentColor }} />
        </div>
      )}
      {sub && <div style={{ marginTop: 6, fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.6 }}>{sub}</div>}
    </Card>
  );
}

/** 说明行：标签 + 值，用于电池明细 */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "5px 0", fontSize: 13, borderBottom: `1px solid ${token.colorFillQuaternary}` }}>
      <span style={{ color: token.colorTextTertiary, flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: "right", wordBreak: "break-all" }}>{value}</span>
    </div>
  );
}

/** 系统信息页签：设备资源与服务运行状态，每 5 秒自动刷新 */
export function AdminSystemInfo() {
  const { token } = theme.useToken();
  const { accentColor } = useTheme();
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [sysinfo, setSysInfo] = useState<SysInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, si] = await Promise.all([fetchServerStatus(), fetchSysInfo()]);
      setStatus(st);
      setSysInfo(si);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const batteryOk = sysinfo && sysinfo.battery.level >= 0;
  const memUsed = sysinfo ? sysinfo.memory.sys_total - sysinfo.memory.sys_available : 0;
  const diskPct = sysinfo ? pct(sysinfo.disk.used, sysinfo.disk.total) : 0;
  const memPct = sysinfo && sysinfo.memory.sys_total > 0 ? pct(memUsed, sysinfo.memory.sys_total) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
          <Space size={8}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>设备资源</span>
            <Tag color={failed ? "error" : "success"} style={{ borderRadius: 10, margin: 0 }}>
              {failed ? "获取失败" : "实时同步"}
            </Tag>
          </Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 8 }}>刷新</Button>
        </div>
        <Spin spinning={loading}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={8}>
              <MetricCard
                icon={<ThunderboltFilled />}
                title="UPS 电量"
                value={batteryOk ? sysinfo!.battery.level : "-"}
                suffix={batteryOk ? "%" : undefined}
                progress={batteryOk ? sysinfo!.battery.level : undefined}
                sub={batteryOk ? <span>{sysinfo!.battery.status} · {sysinfo!.battery.power_source} · {sysinfo!.battery.temperature}°C</span> : <span>电量不可用</span>}
              />
            </Col>
            <Col xs={12} md={8}>
              <MetricCard
                icon={<CloudServerOutlined />}
                title="内存占用"
                value={sysinfo && sysinfo.memory.sys_total > 0 ? fmtBytes(memUsed) : "-"}
                suffix={sysinfo && sysinfo.memory.sys_total > 0 ? `${memPct}%` : undefined}
                progress={sysinfo && sysinfo.memory.sys_total > 0 ? memPct : undefined}
                sub={sysinfo ? <span>可用 {fmtBytes(sysinfo.memory.sys_available)} / 共 {fmtBytes(sysinfo.memory.sys_total)}</span> : <span>内存信息不可用</span>}
              />
            </Col>
            <Col xs={24} md={8}>
              <MetricCard
                icon={<HddOutlined />}
                title="硬盘占用"
                value={sysinfo ? fmtBytes(sysinfo.disk.used) : "-"}
                suffix={sysinfo ? `${diskPct}% / ${fmtBytes(sysinfo.disk.total)}` : undefined}
                progress={sysinfo ? diskPct : undefined}
                sub={sysinfo ? <span>剩余 {fmtBytes(sysinfo.disk.free)}</span> : <span>硬盘信息不可用</span>}
              />
            </Col>
          </Row>
        </Spin>
      </Card>

      <Card size="small" styles={{ body: { padding: 14 } }} style={{ borderRadius: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>服务运行</div>
        <Spin spinning={loading}>
          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}>
              <MetricCard
                icon={<DesktopOutlined />}
                title="CPU 核心"
                value={sysinfo ? sysinfo.cpu.cores : "-"}
                suffix={sysinfo ? "核" : undefined}
                sub={sysinfo ? <span>{sysinfo.cpu.arch}{sysinfo.cpu.load.avg1 ? ` · 负载 ${sysinfo.cpu.load.avg1.toFixed(2)}` : ""}</span> : <span>CPU 信息不可用</span>}
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                icon={<FieldTimeOutlined />}
                title="运行时间"
                value={status ? fmtUptime(status.uptime) : "-"}
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                icon={<ApiOutlined />}
                title="API 调用"
                value={status ? status.today_request_count.toLocaleString("zh-CN") : "-"}
                suffix={status ? "次/今日" : undefined}
              />
            </Col>
            <Col xs={12} md={6}>
              <MetricCard
                icon={<DatabaseOutlined />}
                title="数据库大小"
                value={sysinfo ? fmtBytes(sysinfo.db_size) : "-"}
              />
            </Col>
          </Row>
        </Spin>
      </Card>

      {sysinfo && (
        <Card size="small" styles={{ body: { padding: "14px 16px" } }} style={{ borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ color: accentColor, fontSize: 15 }}><ThunderboltFilled /></span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>UPS 详情</span>
          </div>
          <Row gutter={[24, 10]}>
            <Col xs={12} sm={6}><InfoRow label="状态" value={sysinfo.battery.status} /></Col>
            <Col xs={12} sm={6}><InfoRow label="供电方式" value={sysinfo.battery.power_source} /></Col>
            <Col xs={12} sm={6}><InfoRow label="温度" value={`${sysinfo.battery.temperature}°C`} /></Col>
            <Col xs={12} sm={6}><InfoRow label="健康" value={sysinfo.battery.health} /></Col>
            <Col xs={24}><InfoRow label="类型" value={sysinfo.battery.technology} /></Col>
          </Row>
        </Card>
      )}
    </div>
  );
}
