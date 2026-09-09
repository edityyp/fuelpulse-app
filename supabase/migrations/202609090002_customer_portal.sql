BEGIN;

CREATE TABLE app.customers(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations,
  name text NOT NULL CHECK(length(name) BETWEEN 2 AND 80),
  phone_e164 text NOT NULL CHECK(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,phone_e164),
  UNIQUE(organization_id,id)
);
CREATE TABLE app.customer_vehicles(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES app.organizations,
  customer_id uuid NOT NULL,
  plate text NOT NULL CHECK(plate ~ '^[A-Z0-9]{4,15}$'),
  label text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,plate),
  FOREIGN KEY(organization_id,customer_id) REFERENCES app.customers(organization_id,id)
);
CREATE INDEX customer_vehicle_owner ON app.customer_vehicles(organization_id,customer_id);
CREATE TABLE app.customer_otp_challenges(
  id uuid PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES app.organizations,
  customer_id uuid NOT NULL,
  plate text NOT NULL CHECK(plate ~ '^[A-Z0-9]{4,15}$'),
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,customer_id) REFERENCES app.customers(organization_id,id)
);
CREATE INDEX customer_otp_expiry ON app.customer_otp_challenges(expires_at);
CREATE TABLE app.customer_sessions(
  token_hash text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES app.organizations,
  customer_id uuid NOT NULL,
  trusted_until timestamptz NOT NULL,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,customer_id) REFERENCES app.customers(organization_id,id)
);
CREATE INDEX customer_session_expiry ON app.customer_sessions(trusted_until);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['customers','customer_vehicles','customer_otp_challenges','customer_sessions'] LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
  END LOOP;
END $$;

CREATE POLICY customer_staff_read ON app.customers FOR SELECT TO fuelpulse_app USING(organization_id=app.org());
CREATE POLICY customer_staff_manage ON app.customers FOR ALL TO fuelpulse_app USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER')) WITH CHECK(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY vehicle_staff_read ON app.customer_vehicles FOR SELECT TO fuelpulse_app USING(organization_id=app.org());
CREATE POLICY vehicle_staff_manage ON app.customer_vehicles FOR ALL TO fuelpulse_app USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER')) WITH CHECK(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY customer_gateway ON app.customers TO fuelpulse_gateway USING(current_user='fuelpulse_gateway') WITH CHECK(current_user='fuelpulse_gateway');
CREATE POLICY vehicle_gateway ON app.customer_vehicles TO fuelpulse_gateway USING(current_user='fuelpulse_gateway') WITH CHECK(current_user='fuelpulse_gateway');
CREATE POLICY otp_gateway ON app.customer_otp_challenges TO fuelpulse_gateway USING(current_user='fuelpulse_gateway') WITH CHECK(current_user='fuelpulse_gateway');
CREATE POLICY customer_session_gateway ON app.customer_sessions TO fuelpulse_gateway USING(current_user='fuelpulse_gateway') WITH CHECK(current_user='fuelpulse_gateway');
CREATE POLICY transaction_customer_gateway_read ON app.transactions FOR SELECT TO fuelpulse_gateway USING(current_user='fuelpulse_gateway');
CREATE POLICY ledger_customer_gateway_read ON app.points_ledger FOR SELECT TO fuelpulse_gateway USING(current_user='fuelpulse_gateway');
CREATE POLICY ledger_employee_lookup ON app.points_ledger FOR SELECT TO fuelpulse_app USING(organization_id=app.org());

GRANT SELECT,INSERT,UPDATE ON app.customers,app.customer_vehicles TO fuelpulse_app;
GRANT SELECT ON app.customers,app.customer_vehicles TO fuelpulse_gateway;
GRANT SELECT,INSERT,UPDATE,DELETE ON app.customer_otp_challenges,app.customer_sessions TO fuelpulse_gateway;
GRANT SELECT ON app.transactions,app.points_ledger TO fuelpulse_gateway;

COMMIT;
