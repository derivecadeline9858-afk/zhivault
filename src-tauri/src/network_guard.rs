//! SSRF 白名单：远程请求仅允许知乎域名与官方更新域名（PRD §8-3，Rust 壳强制）。

/// 官方更新域名（占位，发布时替换为真实域名，PRD §12 渠道统一）
pub const UPDATES_HOST: &str = "updates.zhivault.app";

fn is_zhihu_host(host: &str) -> bool {
    let host = host.trim_end_matches('.').to_ascii_lowercase();
    // 知乎域 + 知乎图床 CDN（zhimg.com）
    host == "zhihu.com" || host.ends_with(".zhihu.com") || host == "zhimg.com" || host.ends_with(".zhimg.com")
}

fn is_updates_host(host: &str) -> bool {
    host.trim_end_matches('.').eq_ignore_ascii_case(UPDATES_HOST)
}

/// 主机白名单判定：*.zhihu.com（含裸域）或官方更新域
pub fn is_allowed_host(host: &str) -> bool {
    !host.is_empty() && (is_zhihu_host(host) || is_updates_host(host))
}

/// URL 级判定（仅 http/https；解析失败或非白名单主机一律拒绝）
pub fn is_allowed_url(url: &str) -> bool {
    match url::Url::parse(url) {
        Ok(u) => {
            matches!(u.scheme(), "http" | "https")
                && matches!(u.host_str(), Some(h) if is_allowed_host(h))
        }
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zhihu_hosts_allowed() {
        for u in [
            "https://www.zhihu.com/api/v4/answers/1",
            "https://api.zhihu.com/xxx",
            "https://pic1.zhimg.com/v2-a.jpg",
            "https://zhuanlan.zhihu.com/p/123",
            "https://zhihu.com/",
        ] {
            assert!(is_allowed_url(u), "应放行：{u}");
        }
    }

    #[test]
    fn non_whitelisted_hosts_rejected() {
        for u in [
            "https://www.baidu.com/x",
            "https://evil-zhihu.com/api",
            "https://zhihu.com.evil.com/x",
            "https://169.254.169.254/latest",
            "http://localhost:8080/",
            "not-a-url",
            "ftp://zhihu.com/x",
        ] {
            assert!(!is_allowed_url(u), "应拒绝：{u}");
        }
    }

    #[test]
    fn updates_domain_allowed() {
        assert!(is_allowed_url(&format!("https://{UPDATES_HOST}/manifest.json")));
        assert!(!is_allowed_url("https://updates.zhivault.app.evil.com/x"));
    }
}
