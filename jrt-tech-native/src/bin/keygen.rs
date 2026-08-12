// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use slint::ComponentHandle;
use jrt_tech_native::KeygenWindow;
use jrt_tech_native::license::LicenseManager;

fn main() -> Result<(), slint::PlatformError> {
    #[cfg(target_os = "windows")]
    if std::env::var("SLINT_BACKEND").is_err() {
        std::env::set_var("SLINT_BACKEND", "software");
    }

    env_logger::init();
    log::info!("Starting JRT Tech ADMIN Keygen Studio...");

    let keygen_win = KeygenWindow::new()?;
    let win_weak = keygen_win.as_weak();

    keygen_win.on_generate_clicked(move |hwid, name| {
        let clean_hwid = hwid.to_string().trim().to_uppercase();
        let name_str = name.to_string().trim().to_string();

        if clean_hwid.len() >= 10 {
            let key = LicenseManager::generate_key_for_hwid(&clean_hwid);
            let wa_msg = format!(
                "Halo {},\n\nBerikut adalah Kunci Lisensi resmi JRT Tech ANALIST Pro untuk laptop Anda:\n\n*HWID Laptop*: {}\n*Kunci Lisensi*: {}\n\nSilakan masukkan kunci di atas pada layar aktivasi aplikasi.\n\nTerima kasih telah menggunakan JRT Tech ANALIST Pro!",
                if name_str.is_empty() { "Bos" } else { &name_str },
                clean_hwid,
                key
            );

            let _ = win_weak.upgrade_in_event_loop(move |win| {
                win.set_generated_key(slint::SharedString::from(key));
                win.set_formatted_msg(slint::SharedString::from(wa_msg));
            });
        }
    });

    keygen_win.run()
}
