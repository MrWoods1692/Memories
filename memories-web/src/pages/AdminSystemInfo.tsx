import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Button, Card, Col, Row, Space, Spin, Statistic, Tag, Tooltip } from "antd";
import {
  ApiOutlined, CloudServerOutlined, DesktopOutlined, FieldTimeOutlined,
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
  sub: ReactNode;
  progress?: number;
}) {
  const { token } = theme.useToken();
  const { accentColor } = useTheme();
  return (
    <Card size="small" styles={{ body: { padding: "14px 16px" } }} style={{ borderRadius: 14, height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ color: accentColor, fontSize: 15 }}>{icon}</span>
        <span style={{ fontSize: 13, color: token.colorTextSecondary, fontWeight: 600 }}>{title}</span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2, color: token.colorText }}>
        {value}{suffix ? <span style={{ fontSize: 14, fontWeight: 500, marginLeft: 6, color: token.colorTextSecondary }}>{suffix}</span> : null}
      </div>
      {progress !== undefined && (
        <div style={{ marginTop: 10, height: 6, borderRadius: 3, background: token.colorFillSecondary, overflow: "hidden" }}>
          <div style={{ width: `${progress}%`, height: "100%", borderRadius: 3, background: accentColor }} />
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: token.colorTextTertiary, lineHeight: 1.6 }}>{sub}</div>
    </Card>
  );
}

/** 说明行：标签 + 值，用于 CPU / 电池明细 */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", fontSize: 13, borderBottom: `1px solid ${token.colorFillQuaternary}` }}>
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
  return (
    <Card size="small" style={{ borderRadius: 14 }} styles={{ body: { padding: 16 } }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <Space size="small">
          <span style={{ fontSize: 14, fontWeight: 600 }}>运行状态</span>
          <Tag color={failed ? "error" : "success"} style={{ borderRadius: 10, margin: 0 }}>
            {failed ? "获取失败" : "实时同步"}
          </Tag>
        </Space>
        <Button size="small" icon={<ReloadOutlined />} onClick={load} style={{ borderRadius: 8 }}>刷新</Button>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<ThunderboltFilled />}
              title="UPS 电量"
              value={batteryOk ? `${sysinfo!.battery.level}%` : "-"}
              progress={batteryOk ? sysinfo!.battery.level : undefined}
              sub={batteryOk
                ? <span>{sysinfo!.battery.status} · {sysinfo!.battery.power_source} · {sysinfo!.battery.temperature}°C</span>
                : <span>电量不可用</span>}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<CloudServerOutlined />}
              title="内存占用"
              value={sysinfo && sysinfo.memory.sys_total > 0 ? fmtBytes(memUsed) : "-"}
              progress={sysinfo && sysinfo.memory.sys_total > 0 ? pct(memUsed, sysinfo.memory.sys_total) : undefined}
              sub={sysinfo
                ? <span>可用 {fmtBytes(sysinfo.memory.sys_available)} / 共 {fmtBytes(sysinfo.memory.sys_total)}</span>
                : <span>内存信息不可用</span>}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<HddOutlined />}
              title="硬盘占用"
              value={sysinfo ? fmtBytes(sysinfo.disk.used) : "-"}
              suffix={sysinfo ? `/ ${fmtBytes(sysinfo.disk.total)}` : undefined}
              progress={sysinfo ? pct(sysinfo.disk.used, sysinfo.disk.total) : undefined}
              sub={sysinfo ? <span>剩余 {fmtBytes(sysinfo.disk.free)} · 数据库 {fmtBytes(sysinfo.db_size)}</span> : <span>硬盘信息不可用</span>}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<DesktopOutlined />}
              title="CPU 核心"
              value={sysinfo ? sysinfo.cpu.cores : "-"}
              suffix={sysinfo ? "核" : undefined}
              sub={sysinfo ? <span>{sysinfo.cpu.arch}{sysinfo.cpu.load.avg1 ? ` · 负载 ${sysinfo.cpu.load.avg1.toFixed(2)}` : ""}</span> : <span>CPU 信息不可用</span>}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<FieldTimeOutlined />}
              title="运行时间"
              value={status ? fmtUptime(status.uptime) : "-"}
              sub={sysinfo ? <span>{sysinfo.battery.device_model} · Android {sysinfo.battery.android_version}</span> : <span>设备信息不可用</span>}
            />
          </Col>
          <Col xs={12} sm={8} md={6} lg={4}>
            <MetricCard
              icon={<ApiOutlined />}
              title="API 调用"
              value={status ? status.today_request_count.toLocaleString("zh-CN") : "-"}
              sub={status ? <span>今日调用，累计 {status.request_count.toLocaleString("zh-CN")} 次</span> : <span>调用数据不可用</span>}
            />
          </Col>
        </Row>

        {sysinfo && (
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
            <Col xs={24} md={12}>
              <Card size="small" styles={{ body: { padding: "4px 16px 8px" } }} style={{ borderRadius: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: accentColor }}>CPU 详情</div>
                <InfoRow label="型号" value={sysinfo.cpu.model} />
                <InfoRow label="架构" value={`${sysinfo.cpu.arch} · ${sysinfo.cpu.cores} 核`} />
                <InfoRow label="SoC" value={sysinfo.hardware.soc} />
                <InfoRow label="1分钟负载" value={sysinfo.cpu.load.avg1 ? sysinfo.cpu.load.avg1.toFixed(2) : "-"} />
                <InfoRow label="15分钟负载" value={sysinfo.cpu.load.avg15 ? sysinfo.cpu.load.avg15.toFixed(2) : "-"} />
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card size="small" styles={{ body: { padding: "4px 16px 8px" } }} style={{ borderRadius: 12 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: accentColor }}>UPS 详情</div>
                <InfoRow label="状态" value={sysinfo.battery.status} />
                <InfoRow label="供电方式" value={sysinfo.battery.power_source} />
                <InfoRow label="温度" value={`${sysinfo.battery.temperature}°C`} />
                <InfoRow label="电压" value={`${sysinfo.battery.voltage}V`} />
                <InfoRow label="健康" value={sysinfo.battery.health} />
                <InfoRow label="类型" value={sysinfo.battery.technology} />
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </Card>
  );
}
