use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Duration;

pub struct Scheduler {
    interval_minutes: AtomicU64,
    running: AtomicBool,
}

impl Scheduler {
    pub fn new(interval_minutes: u64) -> Self {
        Self {
            interval_minutes: AtomicU64::new(interval_minutes),
            running: AtomicBool::new(false),
        }
    }

    pub fn set_interval(&self, minutes: u64) {
        self.interval_minutes.store(minutes, Ordering::Relaxed);
    }

    pub fn get_interval(&self) -> u64 {
        self.interval_minutes.load(Ordering::Relaxed)
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    pub fn start<F>(self: &Arc<Self>, on_tick: F) -> JoinHandle<()>
    where
        F: Fn() + Send + Sync + 'static,
    {
        self.running.store(true, Ordering::Relaxed);
        let scheduler = Arc::clone(self);

        std::thread::spawn(move || {
            on_tick();

            while scheduler.running.load(Ordering::Relaxed) {
                let seconds = scheduler.interval_minutes.load(Ordering::Relaxed) * 60;
                std::thread::sleep(Duration::from_secs(seconds));

                if !scheduler.running.load(Ordering::Relaxed) {
                    break;
                }

                on_tick();
            }
        })
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::Relaxed);
    }
}
