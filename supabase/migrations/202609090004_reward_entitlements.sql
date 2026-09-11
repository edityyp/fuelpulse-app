BEGIN;

ALTER TABLE app.organizations
  ADD COLUMN reward_quantity_ml integer NOT NULL DEFAULT 1000
    CONSTRAINT organizations_reward_quantity_check CHECK(reward_quantity_ml BETWEEN 100 AND 2000000);

CREATE TABLE app.reward_entitlements(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations,
  plate text NOT NULL CHECK(plate ~ '^[A-Z0-9]{4,15}$'),
  ordinal integer NOT NULL CHECK(ordinal > 0),
  code text NOT NULL UNIQUE CHECK(code ~ '^FPR1:[a-f0-9]{48}$'),
  reward_name text NOT NULL CHECK(length(reward_name) BETWEEN 2 AND 120),
  points_cost integer NOT NULL CHECK(points_cost BETWEEN 1 AND 1000000),
  quantity_ml integer NOT NULL CHECK(quantity_ml BETWEEN 100 AND 2000000),
  redeemed_by uuid,
  redeemed_at timestamptz,
  pump_id uuid,
  fuel_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,plate,ordinal),
  CHECK((redeemed_by IS NULL)=(redeemed_at IS NULL)),
  CHECK((redeemed_at IS NULL)=(pump_id IS NULL)),
  CHECK((redeemed_at IS NULL)=(fuel_id IS NULL)),
  FOREIGN KEY(organization_id,redeemed_by) REFERENCES app.users(organization_id,id),
  FOREIGN KEY(organization_id,pump_id) REFERENCES app.pumps(organization_id,id),
  FOREIGN KEY(organization_id,fuel_id) REFERENCES app.fuels(organization_id,id)
);
CREATE INDEX reward_plate_status ON app.reward_entitlements(organization_id,plate,redeemed_at,created_at);
ALTER TABLE app.reward_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.reward_entitlements FORCE ROW LEVEL SECURITY;

CREATE POLICY reward_staff_read ON app.reward_entitlements FOR SELECT TO fuelpulse_app
  USING(organization_id=app.org());
CREATE POLICY reward_staff_insert ON app.reward_entitlements FOR INSERT TO fuelpulse_app
  WITH CHECK(organization_id=app.org());
CREATE POLICY reward_staff_redeem ON app.reward_entitlements FOR UPDATE TO fuelpulse_app
  USING(organization_id=app.org() AND redeemed_at IS NULL)
  WITH CHECK(organization_id=app.org() AND redeemed_by=app.actor() AND redeemed_at IS NOT NULL);
CREATE POLICY reward_gateway ON app.reward_entitlements TO fuelpulse_gateway
  USING(current_user='fuelpulse_gateway') WITH CHECK(current_user='fuelpulse_gateway');

DROP POLICY customer_staff_manage ON app.customers;
DROP POLICY vehicle_staff_manage ON app.customer_vehicles;
CREATE POLICY customer_staff_insert ON app.customers FOR INSERT TO fuelpulse_app
  WITH CHECK(organization_id=app.org());
CREATE POLICY customer_staff_update ON app.customers FOR UPDATE TO fuelpulse_app
  USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'))
  WITH CHECK(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY customer_staff_delete ON app.customers FOR DELETE TO fuelpulse_app
  USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY vehicle_staff_insert ON app.customer_vehicles FOR INSERT TO fuelpulse_app
  WITH CHECK(organization_id=app.org());
CREATE POLICY vehicle_staff_update ON app.customer_vehicles FOR UPDATE TO fuelpulse_app
  USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'))
  WITH CHECK(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY vehicle_staff_delete ON app.customer_vehicles FOR DELETE TO fuelpulse_app
  USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));

GRANT SELECT,INSERT,UPDATE ON app.reward_entitlements TO fuelpulse_app;
GRANT SELECT,INSERT ON app.reward_entitlements TO fuelpulse_gateway;

COMMIT;
