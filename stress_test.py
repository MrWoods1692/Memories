#!/usr/bin/env python3
"""Memories API 高强度压力测试"""
import concurrent.futures
import time
import urllib.request
import urllib.parse
import ssl
from collections import defaultdict

# 忽略 SSL（本测试无需 HTTPS）
ssl_ctx = ssl.create_default_context()
ssl_ctx.check_hostname = False
ssl_ctx.verify_mode = ssl.CERT_NONE

BASE = "http://192.168.31.178:8080"

def request(path, method="GET", data=None, timeout=30):
    url = BASE + path
    req = urllib.request.Request(url, method=method)
    if data:
        req.data = urllib.parse.urlencode(data).encode()
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    start = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed = time.monotonic() - start
            resp.read()
            return elapsed, resp.status, None
    except Exception as e:
        elapsed = time.monotonic() - start
        return elapsed, None, str(e)

def run_batch(name, path, method, data_gen, total, concurrency):
    """执行一轮并发测试，返回统计数据"""
    print(f"\n  ▶ {name}: {total} 请求 @ {concurrency} 并发  → ", end="", flush=True)

    latencies = []
    statuses = defaultdict(int)
    errors = 0
    error_samples = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = []
        for i in range(total):
            d = data_gen(i) if data_gen else None
            futures.append(executor.submit(request, path, method, d))

        for f in concurrent.futures.as_completed(futures):
            elapsed, status, err = f.result()
            latencies.append(elapsed)
            if err:
                errors += 1
                if len(error_samples) < 3:
                    error_samples.append(err)
            else:
                statuses[status] += 1

    latencies.sort()
    n = len(latencies)
    if n == 0:
        print(f"💀 全部失败! 错误: {error_samples}")
        return None

    avg = sum(latencies) / n
    p50 = latencies[int(n * 0.5)] if n > 0 else 0
    p90 = latencies[int(n * 0.9)] if n > 0 else 0
    p99 = latencies[int(n * 0.99)] if n > 0 else 0
    qps = n / (latencies[-1] + 0.001)

    print(f"OK | 失败:{errors} | avg:{avg*1000:.0f}ms | p99:{p99*1000:.0f}ms | 最大:{latencies[-1]*1000:.0f}ms")
    if error_samples:
        print(f"        错误样本: {error_samples[:2]}")

    return {"total": n, "errors": errors, "avg": avg, "p50": p50, "p90": p90, "p99": p99, "max": latencies[-1]}

def main():
    print("🔥🔥🔥 Memories API 高强度压力测试 🔥🔥🔥")
    print(f"🎯 {BASE}")
    print()

    total_requests = 0
    total_errors = 0
    all_p99 = []

    # ============ 第一轮: 读取端点逐步加压 ============
    print("━" * 60)
    print("📖 第一轮: 读取端点逐步加压")
    print("━" * 60)

    read_endpoints = [
        ("/health", "GET", None),
        ("/status", "GET", None),
        ("/images?page=1&limit=10", "GET", None),
        ("/sysinfo", "GET", None),
    ]

    for concurrency in [10, 50, 100, 200, 300]:
        for ep_path, ep_method, _ in read_endpoints:
            label = f"{ep_method} {ep_path}"
            r = run_batch(label, ep_path, ep_method, None, concurrency * 3, concurrency)
            if r:
                total_requests += r["total"]
                total_errors += r["errors"]
                all_p99.append(r["p99"])

    # ============ 第二轮: 持续写入压力 ============
    print("\n" + "━" * 60)
    print("✏️  第二轮: 纯写入持续压力")
    print("━" * 60)

    test_url = "https://stress-test.local/img"
    for i, (total, conc) in enumerate([(30, 15), (60, 30), (100, 50), (200, 100)]):
        r = run_batch(
            f"POST /images batch{i+1}",
            "/images", "POST",
            lambda idx: {"url": f"{test_url}/{idx}_{int(time.time()*1000)}"},
            total, conc
        )
        if r:
            total_requests += r["total"]
            total_errors += r["errors"]
            all_p99.append(r["p99"])
        time.sleep(0.5)  # 批次间短暂间隔

    # ============ 第三轮: 持续读写混合 ============
    print("\n" + "━" * 60)
    print("⚔️  第三轮: 持续读写混合 (70%读 30%写)")
    print("━" * 60)

    def mixed_task(idx):
        if idx % 10 < 3:  # 30% 写
            return ("/images", "POST", {"url": f"{test_url}/mix/{idx}_{int(time.time()*1000)}"})
        else:  # 70% 读
            reads = ["/health", "/status", "/images?page=1&limit=3"]
            return (reads[idx % 3], "GET", None)

    for concurrency in [50, 100, 200]:
        tasks = [mixed_task(i) for i in range(concurrency * 4)]

        latencies = []
        errors = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
            futures = [executor.submit(request, t[0], t[1], t[2]) for t in tasks]
            for f in concurrent.futures.as_completed(futures):
                elapsed, status, err = f.result()
                latencies.append(elapsed)
                if err: errors += 1

        latencies.sort()
        n = len(latencies)
        avg = sum(latencies) / n
        p99 = latencies[int(n * 0.99)]
        print(f"  ▶ 混合 {concurrency}并发 x4轮 ({n}请求): OK | 失败:{errors} | avg:{avg*1000:.0f}ms | p99:{p99*1000:.0f}ms | 最大:{latencies[-1]*1000:.0f}ms")
        total_requests += n
        total_errors += errors
        all_p99.append(p99)
        time.sleep(0.3)

    # ============ 第四轮: 突发写入 ============
    print("\n" + "━" * 60)
    print("💥 第四轮: 突发写入冲击")
    print("━" * 60)

    def burst_write(idx):
        return ("/images", "POST", {"url": f"{test_url}/burst/{idx}_{int(time.time()*1000)}"})

    for burst_size in [50, 100, 200]:
        tasks = [burst_write(i) for i in range(burst_size)]

        latencies = []
        errors = 0
        start = time.monotonic()
        with concurrent.futures.ThreadPoolExecutor(max_workers=burst_size) as executor:
            futures = [executor.submit(request, t[0], t[1], t[2]) for t in tasks]
            for f in concurrent.futures.as_completed(futures):
                elapsed, status, err = f.result()
                latencies.append(elapsed)
                if err: errors += 1
        wall = time.monotonic() - start

        latencies.sort()
        n = len(latencies)
        avg = sum(latencies) / n
        p99 = latencies[int(n * 0.99)]
        qps = n / wall
        print(f"  ▶ 突发 {burst_size}并发写: OK | 失败:{errors} | avg:{avg*1000:.0f}ms | p99:{p99*1000:.0f}ms | QPS:{qps:.0f} | 耗时:{wall:.1f}s")
        total_requests += n
        total_errors += errors
        all_p99.append(p99)

    # ============ 第五轮: 极限并发 ============
    print("\n" + "━" * 60)
    print("🚀 第五轮: 极限并发冲击")
    print("━" * 60)

    for total in [300, 500, 800]:
        r = run_batch(f"GET /health {total}并发", "/health", "GET", None, total, total)
        if r:
            total_requests += r["total"]
            total_errors += r["errors"]
            all_p99.append(r["p99"])

    # ============ 汇总 ============
    print("\n" + "=" * 65)
    print("📋 测试汇总")
    print("=" * 65)
    print(f"  总请求数:    {total_requests}")
    print(f"  总失败数:    {total_errors}")
    print(f"  成功率:      {100*(total_requests-total_errors)/total_requests:.2f}%")
    if all_p99:
        print(f"  各轮P99范围: {min(all_p99)*1000:.0f}ms ~ {max(all_p99)*1000:.0f}ms")
    print()

    if total_errors == 0:
        print("🏆 全部通过！零失败！写入队列在高并发下表现完美。")
    else:
        print(f"⚠️  存在 {total_errors} 个失败，请检查服务器日志。")

if __name__ == "__main__":
    main()
