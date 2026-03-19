use std::process::Command;

const SERVICE_NAME: &str = "io.innomad.followbar.api-keys";

pub fn set_api_key(provider: &str, key: &str) -> anyhow::Result<()> {
    let _ = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", provider])
        .output();

    let output = Command::new("security")
        .args(["add-generic-password", "-s", SERVICE_NAME, "-a", provider, "-w", key])
        .output()?;

    if !output.status.success() {
        anyhow::bail!(
            "failed to store API key: {}",
            String::from_utf8_lossy(&output.stderr)
        );
    }

    Ok(())
}

pub fn get_api_key(provider: &str) -> anyhow::Result<Option<String>> {
    let output = Command::new("security")
        .args(["find-generic-password", "-s", SERVICE_NAME, "-a", provider, "-w"])
        .output()?;

    if output.status.success() {
        return Ok(Some(String::from_utf8(output.stdout)?.trim().to_string()));
    }

    Ok(None)
}

pub fn delete_api_key(provider: &str) -> anyhow::Result<()> {
    let _ = Command::new("security")
        .args(["delete-generic-password", "-s", SERVICE_NAME, "-a", provider])
        .output()?;
    Ok(())
}

