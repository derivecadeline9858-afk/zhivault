//! 凭据 DPAPI 加密存取（PRD §7.5/§8-1）：内存仅会话副本，落盘必为 DPAPI 密文，注销=删文件+清内存。

use std::path::Path;

use windows::Win32::Foundation::{LocalFree, HLOCAL};
use windows::Win32::Security::Cryptography::{
    CryptProtectData, CryptUnprotectData, CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN,
};

fn to_blob(data: &[u8]) -> CRYPT_INTEGER_BLOB {
    CRYPT_INTEGER_BLOB {
        cbData: data.len() as u32,
        pbData: data.as_ptr() as *mut u8,
    }
}

/// DPAPI 加密（当前用户+本机作用域，UI 不弹窗）
pub fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut input = to_blob(data);
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(
            &mut input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|e| format!("CryptProtectData 失败：{e}"))?;
        let slice =
            std::slice::from_raw_parts(output.pbData as *const u8, output.cbData as usize);
        let out = slice.to_vec();
        LocalFree(Some(HLOCAL(
            output.pbData as *mut core::ffi::c_void,
        )));
        Ok(out)
    }
}

/// DPAPI 解密
pub fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    let mut input = to_blob(data);
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &mut input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|e| format!("CryptUnprotectData 失败：{e}"))?;
        let slice =
            std::slice::from_raw_parts(output.pbData as *const u8, output.cbData as usize);
        let out = slice.to_vec();
        LocalFree(Some(HLOCAL(
            output.pbData as *mut core::ffi::c_void,
        )));
        Ok(out)
    }
}

/// 加密写入 credentials.bin
pub fn save(path: &Path, plaintext: &str) -> Result<(), String> {
    let blob = protect(plaintext.as_bytes())?;
    std::fs::write(path, blob).map_err(|e| format!("凭据写入失败：{e}"))
}

/// 读并解密；文件不存在返回 None
pub fn load(path: &Path) -> Result<Option<String>, String> {
    match std::fs::read(path) {
        Ok(blob) => {
            let plain = unprotect(&blob)?;
            String::from_utf8(plain).map(Some).map_err(|e| format!("凭据非 UTF-8：{e}"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("凭据读取失败：{e}")),
    }
}

/// 注销全链路（文件删除；内存副本由调用方清）
pub fn clear(path: &Path) -> Result<(), String> {
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("凭据删除失败：{e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dpapi_roundtrip() {
        let secret = "z_c0=2|1:secret-value;d_c0=abc";
        let blob = protect(secret.as_bytes()).expect("protect");
        assert_ne!(blob, secret.as_bytes(), "密文不得等于明文");
        let plain = unprotect(&blob).expect("unprotect");
        assert_eq!(plain, secret.as_bytes());
    }

    #[test]
    fn load_missing_returns_none() {
        let dir = std::env::temp_dir().join("zhivault-cred-test-missing");
        assert!(load(&dir).expect("missing").is_none());
    }

    #[test]
    fn save_load_clear_lifecycle() {
        let path = std::env::temp_dir().join("zhivault-cred-test.bin");
        let _ = clear(&path);
        save(&path, "cookie-data").expect("save");
        assert_eq!(load(&path).expect("load"), Some("cookie-data".to_string()));
        clear(&path).expect("clear");
        assert!(load(&path).expect("after clear").is_none());
    }
}
