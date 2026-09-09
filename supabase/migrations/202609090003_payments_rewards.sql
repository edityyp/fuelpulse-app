alter table app.transactions
  add column payment_method text not null default 'CASH'
  constraint transactions_payment_method_check check (payment_method in ('CASH', 'UPI'));

alter table app.organizations
  add column reward_threshold_points integer not null default 100
    constraint organizations_reward_threshold_check check (reward_threshold_points between 1 and 1000000),
  add column reward_name text not null default 'FuelPulse reward'
    constraint organizations_reward_name_check check (length(reward_name) between 2 and 120);
