use crate::db::Database;

pub const MILESTONE_TARGETS: &[u64] = &[
    100,
    500,
    1_000,
    2_000,
    5_000,
    10_000,
    20_000,
    50_000,
    100_000,
    500_000,
    1_000_000,
];

pub struct MilestoneChecker;

impl MilestoneChecker {
    pub fn check(
        db: &Database,
        account_id: &str,
        prev_followers: u64,
        current_followers: u64,
    ) -> Vec<(i64, u64)> {
        if current_followers <= prev_followers {
            return Vec::new();
        }

        let mut reached = Vec::new();

        if let Ok(unreached) = db.get_unreached_milestones(account_id) {
            for milestone in unreached {
                if prev_followers < milestone.target && current_followers >= milestone.target {
                    if db.mark_milestone_reached(milestone.id).is_ok() {
                        reached.push((milestone.id, milestone.target));
                    }
                }
            }
        }

        reached
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;
    use std::path::PathBuf;

    #[test]
    fn test_milestone_detection() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None, None, None)
            .unwrap();
        db.ensure_milestones_for_account("acc1", 80).unwrap();

        let reached = MilestoneChecker::check(&db, "acc1", 80, 120);
        assert_eq!(reached.len(), 1);
        assert_eq!(reached[0].1, 100);

        let reached = MilestoneChecker::check(&db, "acc1", 120, 130);
        assert_eq!(reached.len(), 0);
    }

    #[test]
    fn test_no_milestone_on_decrease() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None, None, None)
            .unwrap();
        db.ensure_milestones_for_account("acc1", 150).unwrap();

        let reached = MilestoneChecker::check(&db, "acc1", 150, 100);
        assert!(reached.is_empty());
    }

    #[test]
    fn test_multiple_milestones_crossed() {
        let db = Database::open(&PathBuf::from(":memory:")).unwrap();
        db.add_account("acc1", "bilibili", "user", None, None, None)
            .unwrap();
        db.ensure_milestones_for_account("acc1", 80).unwrap();

        let reached = MilestoneChecker::check(&db, "acc1", 80, 1200);
        assert_eq!(reached.len(), 3);
        let targets: Vec<u64> = reached.iter().map(|(_, target)| *target).collect();
        assert!(targets.contains(&100));
        assert!(targets.contains(&500));
        assert!(targets.contains(&1000));
    }
}
