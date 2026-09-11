-- Reconstructed additive baseline. Never apply to an unknown existing schema.
CREATE SCHEMA app;
CREATE ROLE fuelpulse_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE fuelpulse_gateway NOLOGIN NOSUPERUSER NOBYPASSRLS;
GRANT fuelpulse_app TO fuelpulse_gateway;
REVOKE ALL ON SCHEMA app FROM PUBLIC;
GRANT USAGE ON SCHEMA app TO fuelpulse_app,fuelpulse_gateway;
CREATE FUNCTION app.org() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org',true),'')::uuid $$;
CREATE FUNCTION app.actor() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.actor',true),'')::uuid $$;
CREATE FUNCTION app.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.role',true),'') $$;
CREATE TABLE app.organizations(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL UNIQUE CHECK(slug ~ '^[a-z0-9-]{3,40}$'),name text NOT NULL,timezone text NOT NULL DEFAULT 'Asia/Kolkata',points_per_litre integer NOT NULL DEFAULT 1 CHECK(points_per_litre BETWEEN 0 AND 100),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES app.organizations,code text NOT NULL,name text NOT NULL,role text NOT NULL CHECK(role IN ('OWNER','MANAGER','EMPLOYEE')),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,code),UNIQUE(organization_id,id));
CREATE TABLE app.credentials(user_id uuid PRIMARY KEY REFERENCES app.users,password_hash text NOT NULL,encrypted_password text,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.sessions(token_hash text PRIMARY KEY,user_id uuid NOT NULL REFERENCES app.users,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX sessions_expiry ON app.sessions(expires_at);
CREATE TABLE app.login_limits(key text PRIMARY KEY,attempts integer NOT NULL,until_at timestamptz NOT NULL);
CREATE TABLE app.login_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,account_hash text NOT NULL,ip_hash text NOT NULL,success boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app.pumps(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES app.organizations,name text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,name));
CREATE TABLE app.fuels(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES app.organizations,name text NOT NULL,price_paise integer NOT NULL CHECK(price_paise BETWEEN 1 AND 100000),UNIQUE(organization_id,id),UNIQUE(organization_id,name));
CREATE TABLE app.pump_fuels(organization_id uuid NOT NULL,pump_id uuid NOT NULL,fuel_id uuid NOT NULL,PRIMARY KEY(pump_id,fuel_id),FOREIGN KEY(organization_id,pump_id) REFERENCES app.pumps(organization_id,id),FOREIGN KEY(organization_id,fuel_id) REFERENCES app.fuels(organization_id,id));
CREATE TABLE app.daily_counts(organization_id uuid NOT NULL,pump_id uuid NOT NULL,plate text NOT NULL,business_day date NOT NULL,n integer NOT NULL CHECK(n>0),PRIMARY KEY(organization_id,pump_id,plate,business_day),FOREIGN KEY(organization_id,pump_id) REFERENCES app.pumps(organization_id,id));
CREATE TABLE app.transactions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES app.organizations,pump_id uuid NOT NULL,employee_id uuid NOT NULL,fuel_id uuid NOT NULL,plate text NOT NULL CHECK(plate ~ '^[A-Z0-9]{4,15}$'),quantity_ml integer NOT NULL CHECK(quantity_ml BETWEEN 100 AND 2000000),price_paise integer NOT NULL CHECK(price_paise>0),amount_paise bigint NOT NULL CHECK(amount_paise>0),points integer NOT NULL CHECK(points>=0),fraud boolean NOT NULL,business_day date NOT NULL,idempotency_key uuid NOT NULL,request_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(organization_id,id),UNIQUE(organization_id,idempotency_key),FOREIGN KEY(organization_id,pump_id) REFERENCES app.pumps(organization_id,id),FOREIGN KEY(organization_id,employee_id) REFERENCES app.users(organization_id,id),FOREIGN KEY(organization_id,fuel_id) REFERENCES app.fuels(organization_id,id));
CREATE INDEX transaction_recent ON app.transactions(organization_id,created_at DESC);
CREATE INDEX transaction_employee ON app.transactions(organization_id,employee_id,created_at DESC);
CREATE TABLE app.points_ledger(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL,plate text NOT NULL,transaction_id uuid NOT NULL UNIQUE,points integer NOT NULL CHECK(points>=0),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,transaction_id) REFERENCES app.transactions(organization_id,id));
CREATE INDEX points_balance ON app.points_ledger(organization_id,plate);
CREATE TABLE app.coupons(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES app.organizations,code text NOT NULL UNIQUE,plate text NOT NULL,expires_at timestamptz NOT NULL,created_by uuid NOT NULL,redeemed_by uuid,redeemed_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK((redeemed_by IS NULL)=(redeemed_at IS NULL)),FOREIGN KEY(organization_id,created_by) REFERENCES app.users(organization_id,id),FOREIGN KEY(organization_id,redeemed_by) REFERENCES app.users(organization_id,id));
CREATE TABLE app.audit_logs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,organization_id uuid NOT NULL,actor_id uuid NOT NULL,action text NOT NULL,target_id uuid,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(organization_id,actor_id) REFERENCES app.users(organization_id,id));
CREATE INDEX audit_recent ON app.audit_logs(organization_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['organizations','users','credentials','sessions','login_limits','login_events','pumps','fuels','pump_fuels','daily_counts','transactions','points_ledger','coupons','audit_logs'] LOOP
 EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE app.%I FORCE ROW LEVEL SECURITY',t);
 END LOOP;
END $$;
CREATE POLICY organization_read ON app.organizations FOR SELECT TO fuelpulse_app USING(id=app.org());
CREATE POLICY organization_write ON app.organizations FOR UPDATE TO fuelpulse_app USING(id=app.org() AND app.role()='OWNER') WITH CHECK(id=app.org());
CREATE POLICY user_read ON app.users FOR SELECT TO fuelpulse_app USING(organization_id=app.org() AND (app.role() IN ('OWNER','MANAGER') OR id=app.actor()));
CREATE POLICY user_write ON app.users FOR ALL TO fuelpulse_app USING(organization_id=app.org() AND (app.role()='OWNER' AND role<>'OWNER' OR app.role()='MANAGER' AND role='EMPLOYEE')) WITH CHECK(organization_id=app.org() AND (app.role()='OWNER' AND role<>'OWNER' OR app.role()='MANAGER' AND role='EMPLOYEE'));
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pumps','fuels','pump_fuels'] LOOP
 EXECUTE format('CREATE POLICY read ON app.%I FOR SELECT TO fuelpulse_app USING(organization_id=app.org())',t);
 EXECUTE format('CREATE POLICY manage ON app.%I FOR ALL TO fuelpulse_app USING(organization_id=app.org() AND app.role() IN (''OWNER'',''MANAGER'')) WITH CHECK(organization_id=app.org() AND app.role() IN (''OWNER'',''MANAGER''))',t);
 END LOOP;
END $$;
CREATE POLICY transaction_read ON app.transactions FOR SELECT TO fuelpulse_app USING(organization_id=app.org() AND (app.role() IN ('OWNER','MANAGER') OR employee_id=app.actor()));
CREATE POLICY transaction_insert ON app.transactions FOR INSERT TO fuelpulse_app WITH CHECK(organization_id=app.org() AND employee_id=app.actor());
CREATE POLICY counts_scope ON app.daily_counts FOR ALL TO fuelpulse_app USING(organization_id=app.org()) WITH CHECK(organization_id=app.org());
CREATE POLICY ledger_read ON app.points_ledger FOR SELECT TO fuelpulse_app USING(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER'));
CREATE POLICY ledger_insert ON app.points_ledger FOR INSERT TO fuelpulse_app WITH CHECK(organization_id=app.org());
CREATE POLICY coupon_read ON app.coupons FOR SELECT TO fuelpulse_app USING(organization_id=app.org());
CREATE POLICY coupon_insert ON app.coupons FOR INSERT TO fuelpulse_app WITH CHECK(organization_id=app.org() AND app.role() IN ('OWNER','MANAGER') AND created_by=app.actor());
CREATE POLICY coupon_update ON app.coupons FOR UPDATE TO fuelpulse_app USING(organization_id=app.org()) WITH CHECK(organization_id=app.org() AND redeemed_by=app.actor());
CREATE POLICY audit_read ON app.audit_logs FOR SELECT TO fuelpulse_app USING(organization_id=app.org() AND app.role()='OWNER');
CREATE POLICY audit_insert ON app.audit_logs FOR INSERT TO fuelpulse_app WITH CHECK(organization_id=app.org() AND actor_id=app.actor());
GRANT SELECT,UPDATE ON app.organizations TO fuelpulse_app;
GRANT SELECT,INSERT,UPDATE ON app.users,app.pumps,app.fuels,app.pump_fuels,app.daily_counts,app.coupons TO fuelpulse_app;
GRANT SELECT,INSERT ON app.transactions,app.points_ledger,app.audit_logs TO fuelpulse_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA app TO fuelpulse_app,fuelpulse_gateway;
GRANT SELECT ON app.organizations,app.users TO fuelpulse_gateway;
CREATE POLICY gateway_org ON app.organizations FOR SELECT TO fuelpulse_gateway USING(current_user='fuelpulse_gateway');
CREATE POLICY gateway_user ON app.users FOR SELECT TO fuelpulse_gateway USING(current_user='fuelpulse_gateway');
GRANT SELECT,INSERT,UPDATE,DELETE ON app.credentials,app.sessions,app.login_limits TO fuelpulse_gateway;
GRANT INSERT ON app.login_events TO fuelpulse_gateway;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['credentials','sessions','login_limits','login_events'] LOOP
 EXECUTE format('CREATE POLICY gateway ON app.%I TO fuelpulse_gateway USING(current_user=''fuelpulse_gateway'') WITH CHECK(current_user=''fuelpulse_gateway'')',t);
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO fuelpulse_app,fuelpulse_gateway;
