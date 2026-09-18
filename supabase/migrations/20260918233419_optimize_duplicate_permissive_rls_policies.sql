-- Preserve existing access semantics while removing duplicate permissive policy evaluation.

DROP POLICY IF EXISTS collection_products_admin_write ON public.collection_products;
CREATE POLICY collection_products_admin_insert ON public.collection_products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY collection_products_admin_update ON public.collection_products FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY collection_products_admin_delete ON public.collection_products FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS collections_admin_write ON public.collections;
CREATE POLICY collections_admin_insert ON public.collections FOR INSERT WITH CHECK (is_admin());
CREATE POLICY collections_admin_update ON public.collections FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY collections_admin_delete ON public.collections FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS design_proofs_admin_write ON public.design_proofs;
CREATE POLICY design_proofs_admin_insert ON public.design_proofs FOR INSERT WITH CHECK (is_admin());
CREATE POLICY design_proofs_admin_update ON public.design_proofs FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY design_proofs_admin_delete ON public.design_proofs FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS order_items_admin_write ON public.order_items;
CREATE POLICY order_items_admin_insert ON public.order_items FOR INSERT WITH CHECK (is_admin());
CREATE POLICY order_items_admin_update ON public.order_items FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY order_items_admin_delete ON public.order_items FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS order_status_events_admin_write ON public.order_status_events;
CREATE POLICY order_status_events_admin_insert ON public.order_status_events FOR INSERT WITH CHECK (is_admin());
CREATE POLICY order_status_events_admin_update ON public.order_status_events FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY order_status_events_admin_delete ON public.order_status_events FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS orders_admin_write ON public.orders;
CREATE POLICY orders_admin_insert ON public.orders FOR INSERT WITH CHECK (is_admin());
CREATE POLICY orders_admin_update ON public.orders FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY orders_admin_delete ON public.orders FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS variants_admin_write ON public.product_variants;
CREATE POLICY variants_admin_insert ON public.product_variants FOR INSERT WITH CHECK (is_admin());
CREATE POLICY variants_admin_update ON public.product_variants FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY variants_admin_delete ON public.product_variants FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS products_admin_write ON public.products;
CREATE POLICY products_admin_insert ON public.products FOR INSERT WITH CHECK (is_admin());
CREATE POLICY products_admin_update ON public.products FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY products_admin_delete ON public.products FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS proof_versions_admin_write ON public.proof_versions;
CREATE POLICY proof_versions_admin_insert ON public.proof_versions FOR INSERT WITH CHECK (is_admin());
CREATE POLICY proof_versions_admin_update ON public.proof_versions FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY proof_versions_admin_delete ON public.proof_versions FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS store_settings_admin_write ON public.store_settings;
CREATE POLICY store_settings_admin_insert ON public.store_settings FOR INSERT WITH CHECK (is_admin());
CREATE POLICY store_settings_admin_update ON public.store_settings FOR UPDATE USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY store_settings_admin_delete ON public.store_settings FOR DELETE USING (is_admin());

DROP POLICY IF EXISTS admins_read_ai_credit_accounts ON public.ai_credit_accounts;
DROP POLICY IF EXISTS customers_read_own_ai_credit_account ON public.ai_credit_accounts;
CREATE POLICY ai_credit_accounts_read_own_or_admin ON public.ai_credit_accounts FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.is_admin()));

DROP POLICY IF EXISTS admins_read_ai_credit_ledger ON public.ai_credit_ledger;
DROP POLICY IF EXISTS customers_read_own_ai_credit_ledger ON public.ai_credit_ledger;
CREATE POLICY ai_credit_ledger_read_own_or_admin ON public.ai_credit_ledger FOR SELECT TO authenticated USING (((select auth.uid()) = user_id) OR (select private.is_admin()));

DROP POLICY IF EXISTS marketing_consents_admin_all ON public.marketing_consents;
DROP POLICY IF EXISTS marketing_consents_owner_read ON public.marketing_consents;
CREATE POLICY marketing_consents_read_own_or_admin ON public.marketing_consents FOR SELECT TO authenticated USING ((user_id = (select auth.uid())) OR (select is_admin()));
CREATE POLICY marketing_consents_admin_insert ON public.marketing_consents FOR INSERT TO authenticated WITH CHECK ((select is_admin()));
CREATE POLICY marketing_consents_admin_update ON public.marketing_consents FOR UPDATE TO authenticated USING ((select is_admin())) WITH CHECK ((select is_admin()));
CREATE POLICY marketing_consents_admin_delete ON public.marketing_consents FOR DELETE TO authenticated USING ((select is_admin()));

DROP POLICY IF EXISTS policy_acceptances_admin_all ON public.policy_acceptances;
DROP POLICY IF EXISTS policy_acceptances_owner_read ON public.policy_acceptances;
CREATE POLICY policy_acceptances_read_own_or_admin ON public.policy_acceptances FOR SELECT TO authenticated USING ((user_id = (select auth.uid())) OR (select is_admin()));
CREATE POLICY policy_acceptances_admin_insert ON public.policy_acceptances FOR INSERT TO authenticated WITH CHECK ((select is_admin()));
CREATE POLICY policy_acceptances_admin_update ON public.policy_acceptances FOR UPDATE TO authenticated USING ((select is_admin())) WITH CHECK ((select is_admin()));
CREATE POLICY policy_acceptances_admin_delete ON public.policy_acceptances FOR DELETE TO authenticated USING ((select is_admin()));

DROP POLICY IF EXISTS privacy_requests_admin_all ON public.privacy_requests;
DROP POLICY IF EXISTS privacy_requests_owner_insert ON public.privacy_requests;
DROP POLICY IF EXISTS privacy_requests_owner_read ON public.privacy_requests;
CREATE POLICY privacy_requests_read_own_or_admin ON public.privacy_requests FOR SELECT TO authenticated USING ((user_id = (select auth.uid())) OR (select is_admin()));
CREATE POLICY privacy_requests_insert_own_or_admin ON public.privacy_requests FOR INSERT TO authenticated WITH CHECK ((select is_admin()) OR ((user_id = (select auth.uid())) AND (status = 'open'::text)));
CREATE POLICY privacy_requests_admin_update ON public.privacy_requests FOR UPDATE TO authenticated USING ((select is_admin())) WITH CHECK ((select is_admin()));
CREATE POLICY privacy_requests_admin_delete ON public.privacy_requests FOR DELETE TO authenticated USING ((select is_admin()));

DROP POLICY IF EXISTS saved_designs_admin_read ON public.saved_designs;
DROP POLICY IF EXISTS saved_designs_owner_all ON public.saved_designs;
CREATE POLICY saved_designs_read_own_or_admin ON public.saved_designs FOR SELECT USING ((user_id = (select auth.uid())) OR is_admin());
CREATE POLICY saved_designs_owner_insert ON public.saved_designs FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY saved_designs_owner_update ON public.saved_designs FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY saved_designs_owner_delete ON public.saved_designs FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS wishlist_admin_read ON public.wishlist_items;
DROP POLICY IF EXISTS wishlist_owner_all ON public.wishlist_items;
CREATE POLICY wishlist_read_own_or_admin ON public.wishlist_items FOR SELECT USING ((user_id = (select auth.uid())) OR is_admin());
CREATE POLICY wishlist_owner_insert ON public.wishlist_items FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY wishlist_owner_update ON public.wishlist_items FOR UPDATE USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY wishlist_owner_delete ON public.wishlist_items FOR DELETE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS order_activity_events_admin_read ON public.order_activity_events;
DROP POLICY IF EXISTS order_activity_events_customer_read ON public.order_activity_events;
CREATE POLICY order_activity_events_read_customer_or_admin ON public.order_activity_events FOR SELECT TO authenticated USING (is_admin() OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_activity_events.order_id AND o.user_id = (select auth.uid())));