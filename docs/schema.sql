  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TABLE public.institutes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    name text NOT NULL,
    address text,
    logo_url text,
    CONSTRAINT institutes_pkey PRIMARY KEY (id)
  );

  CREATE TABLE public.app_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL UNIQUE,
    upi_id text,
    payment_link text,
    about_text text,
    institute_name text,
    institute_address text,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    CONSTRAINT app_settings_pkey PRIMARY KEY (id),
    CONSTRAINT app_settings_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.fees_structure (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    institute_id uuid NOT NULL,
    batch_name text NOT NULL,
    total_fee numeric NOT NULL DEFAULT 0,
    CONSTRAINT fees_structure_pkey PRIMARY KEY (id),
    CONSTRAINT fees_structure_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.profiles (
    id uuid NOT NULL,
    institute_id uuid NOT NULL,
    role text DEFAULT 'admin'::text,
    full_name text,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT profiles_pkey PRIMARY KEY (id),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
    CONSTRAINT profiles_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.students (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    name text NOT NULL,
    parent_phone text NOT NULL,
    batch_name text NOT NULL,
    joining_date date DEFAULT CURRENT_DATE,
    total_fee_package numeric DEFAULT 0,
    paid_amount numeric DEFAULT 0,
    monthly_installment_plan boolean DEFAULT false,
    pending_payment numeric DEFAULT 0,
    enrolled_subjects text[],
    secret_slug text DEFAULT encode(extensions.gen_random_bytes(6), 'hex'::text) UNIQUE,
    last_payment_status text DEFAULT 'approved'::text,
    last_payment_remarks text,
    is_promoting boolean DEFAULT false,
    promotion_target_batch text,
    CONSTRAINT students_pkey PRIMARY KEY (id),
    CONSTRAINT students_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.subjects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    name text NOT NULL,
    batch_name text NOT NULL,
    default_fee numeric NOT NULL DEFAULT 0,
    CONSTRAINT subjects_pkey PRIMARY KEY (id),
    CONSTRAINT subjects_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.tests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    name text NOT NULL,
    date date NOT NULL,
    batch_name text NOT NULL,
    subject_name text NOT NULL,
    total_marks numeric NOT NULL DEFAULT 20,
    CONSTRAINT tests_pkey PRIMARY KEY (id),
    CONSTRAINT tests_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id)
  );

  CREATE TABLE public.attendance (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    date date NOT NULL,
    status text NOT NULL CHECK (status = ANY (ARRAY['present'::text, 'absent'::text, 'holiday'::text])),
    student_id uuid,
    batch_name text,
    CONSTRAINT attendance_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
    CONSTRAINT attendance_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
  );

  CREATE TABLE public.exam_marks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    test_id uuid NOT NULL,
    student_id uuid NOT NULL,
    marks_obtained numeric NOT NULL DEFAULT 0,
    CONSTRAINT exam_marks_pkey PRIMARY KEY (id),
    CONSTRAINT exam_marks_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
    CONSTRAINT exam_marks_test_id_fkey FOREIGN KEY (test_id) REFERENCES public.tests(id),
    CONSTRAINT exam_marks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
  );

  CREATE TABLE public.payment_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    institute_id uuid NOT NULL,
    student_id uuid NOT NULL,
    amount numeric NOT NULL,
    upi_ref_id text,
    status text DEFAULT 'pending'::text,
    admin_remarks text,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT payment_requests_pkey PRIMARY KEY (id),
    CONSTRAINT payment_requests_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
    CONSTRAINT payment_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
  );

  CREATE TABLE public.student_subjects (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL,
    student_id uuid NOT NULL,
    subject_name text NOT NULL,
    batch_name text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT student_subjects_pkey PRIMARY KEY (id),
    CONSTRAINT student_subjects_institute_id_fkey FOREIGN KEY (institute_id) REFERENCES public.institutes(id),
    CONSTRAINT student_subjects_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id)
  );

  -- FUNCTIONS

  CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  BEGIN
      NEW.updated_at = now();
      RETURN NEW;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.get_student_portal_data(p_slug text)
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    v_student_record RECORD;
    v_student_json json;
    v_institute_id uuid;
    v_institute_data json;
    v_attendance_data json;
    v_recent_marks_data json;
    v_all_marks_data json;
    v_upcoming_tests json;
    v_settings_data json;
  BEGIN
    -- 1. Validate Slug & Get Student
    SELECT * INTO v_student_record FROM students WHERE secret_slug = p_slug;
    
    IF v_student_record.id IS NULL THEN
      RAISE EXCEPTION 'Invalid Link';
    END IF;

    v_institute_id := v_student_record.institute_id;
    v_student_json := row_to_json(v_student_record);

    -- 2. Get Institute Details (Public info only)
    SELECT json_build_object('name', name, 'logo_url', logo_url)
    INTO v_institute_data
    FROM institutes
    WHERE id = v_institute_id;
    
    -- 3. Get Attendance (Limit 30)
    SELECT json_agg(t) INTO v_attendance_data
    FROM (
      SELECT * FROM attendance 
      WHERE student_id = v_student_record.id 
      ORDER BY date DESC 
      LIMIT 30
    ) t;

    -- 4. Get Recent Exam Marks (Recent 10)
    -- Join with tests table to get test names
    SELECT json_agg(t) INTO v_recent_marks_data
    FROM (
      SELECT 
        m.marks_obtained, 
        m.created_at,
        json_build_object(
          'name', t.name, 
          'date', t.date, 
          'total_marks', t.total_marks, 
          'subject_name', t.subject_name
        ) as tests
      FROM exam_marks m
      JOIN tests t ON m.test_id = t.id
      WHERE m.student_id = v_student_record.id
      ORDER BY m.created_at DESC
      LIMIT 10
    ) t;


    -- 5. Get All Exam Marks (For Chart - Ascending)
    SELECT json_agg(t) INTO v_all_marks_data
    FROM (
      SELECT 
        m.marks_obtained, 
        json_build_object(
          'name', t.name, 
          'total_marks', t.total_marks
        ) as tests
      FROM exam_marks m
      JOIN tests t ON m.test_id = t.id
      WHERE m.student_id = v_student_record.id
      ORDER BY m.created_at ASC
    ) t;

    -- 6. Get Upcoming Tests
    SELECT json_agg(t) INTO v_upcoming_tests
    FROM (
      SELECT * FROM tests 
      WHERE institute_id = v_institute_id 
      AND batch_name = v_student_record.batch_name
      AND date > CURRENT_DATE
      ORDER BY date ASC
    ) t;
    
    -- 7. Get App Settings
    SELECT row_to_json(a) INTO v_settings_data
    FROM app_settings a
    WHERE institute_id = v_institute_id;

    -- 8. Return Composite JSON
    RETURN json_build_object(
      'student', v_student_json,
      'institute', v_institute_data,
      'attendance', COALESCE(v_attendance_data, '[]'::json),
      'recent_marks', COALESCE(v_recent_marks_data, '[]'::json),
      'all_marks', COALESCE(v_all_marks_data, '[]'::json),
      'upcoming_tests', COALESCE(v_upcoming_tests, '[]'::json),
      'settings', v_settings_data
    );
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.get_my_institute_id()
  RETURNS uuid
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
    SELECT institute_id FROM public.profiles WHERE id = auth.uid();
  $function$;
  REVOKE EXECUTE ON FUNCTION public.get_my_institute_id() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.get_my_institute_id() TO authenticated;

  CREATE OR REPLACE FUNCTION public.promote_students(p_student_ids uuid[], p_new_batch_name text, p_new_fee numeric, p_institute_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    -- Perform the Update
    UPDATE students
    SET 
      batch_name = p_new_batch_name,
      
      -- The Smart Math: Logic to carry forward credit
      paid_amount = GREATEST(0, COALESCE(paid_amount, 0) - COALESCE(total_fee_package, 0)),
      
      total_fee_package = p_new_fee,
      pending_payment = 0,
      last_payment_status = NULL,
      last_payment_remarks = NULL
      
    WHERE 
      id = ANY(p_student_ids) 
      AND institute_id = p_institute_id;

  END;
  $function$;
  REVOKE EXECUTE ON FUNCTION public.promote_students(uuid[], text, numeric, uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.promote_students(uuid[], text, numeric, uuid) TO authenticated;

  CREATE OR REPLACE FUNCTION public.handle_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.process_payment_decision(p_request_id uuid, p_status text, p_remarks text)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  DECLARE
    v_student_id uuid;
  BEGIN
    -- A. Update the Request Table (Record the decision)
    UPDATE payment_requests 
    SET status = p_status, admin_remarks = p_remarks 
    WHERE id = p_request_id 
    RETURNING student_id INTO v_student_id;

    -- B. Update the Student Table based on the status
    IF p_status = 'rejected' THEN
      -- If Rejected: CLEAR the pending claim so the student can try again
      UPDATE students 
      SET 
        pending_payment = 0, 
        last_payment_status = 'rejected',
        last_payment_remarks = p_remarks
      WHERE id = v_student_id;
      
    ELSIF p_status = 'approved' THEN
      -- If Approved (Optional, if you move approval logic here later):
      -- Logic: Add pending to paid, clear pending
      UPDATE students
      SET
        paid_amount = COALESCE(paid_amount, 0) + COALESCE(pending_payment, 0),
        pending_payment = 0,
        last_payment_status = 'approved',
        last_payment_remarks = NULL
      WHERE id = v_student_id;
    END IF;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.sync_batch_to_subjects()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  BEGIN
      -- Check if the new batch_name is valid
          IF NEW.batch_name IS NOT NULL AND NEW.batch_name <> '' THEN
                  
                          -- Check if this batch already exists in the 'subjects' table
                                  IF NOT EXISTS (
                                              SELECT 1 FROM public.subjects 
                                                          WHERE batch_name = NEW.batch_name 
                                                                      AND institute_id = NEW.institute_id
                                                                              ) THEN
                                                                                          
                                                                                                      -- IT DOES NOT EXIST. Insert 'General' subject with 5000 fees.
                                                                                                                  -- ⚠️ NOTE: Check if your column is named 'fees', 'amount', or 'price'
                                                                                                                              INSERT INTO public.subjects (institute_id, batch_name, name, default_fee)
                                                                                                                                          VALUES (NEW.institute_id, NEW.batch_name, 'General', 5000);
                                                                                                                                                      
                                                                                                                                                              END IF;
                                                                                                                                                                  END IF;
                                                                                                                                                                      
                                                                                                                                                                          RETURN NEW;
                                                                                                                                                                          END;
                                                                                                                                                                          $function$;

  CREATE OR REPLACE FUNCTION public.admin_enable_promotion(p_student_ids uuid[], p_target_batch text, p_institute_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO 'public'
  AS $function$
  BEGIN
    UPDATE students
    SET
      is_promoting = true,
      promotion_target_batch = p_target_batch
    WHERE id = ANY(p_student_ids) AND institute_id = p_institute_id;
  END;
  $function$;
  REVOKE EXECUTE ON FUNCTION public.admin_enable_promotion(uuid[], text, uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.admin_enable_promotion(uuid[], text, uuid) TO authenticated;

  CREATE OR REPLACE FUNCTION public.auto_set_institute_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    IF NEW.institute_id IS NULL THEN
      NEW.institute_id := (SELECT institute_id FROM public.profiles WHERE id = auth.uid());
    END IF;
    RETURN NEW;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.submit_payment_claim(p_secret_slug text, p_amount numeric, p_upi_ref text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    v_student_id uuid;
    v_institute_id uuid;
  BEGIN
    -- A. Find the student and institute based on the secret link
    SELECT id, institute_id INTO v_student_id, v_institute_id
    FROM students
    WHERE secret_slug = p_secret_slug;

    -- B. Validation
    IF v_student_id IS NULL THEN
      RAISE EXCEPTION 'Invalid Student Link';
    END IF;

    -- C. Insert into payment_requests table
    INSERT INTO payment_requests (
        student_id, 
        institute_id, 
        amount, 
        upi_ref_id, 
        status
    )
    VALUES (
        v_student_id, 
        v_institute_id, 
        p_amount, 
        p_upi_ref, 
        'pending'
    );

    -- D. Update student status to show "Verification Pending" on UI
    UPDATE students
    SET pending_payment = p_amount,
        last_payment_status = 'pending'
    WHERE id = v_student_id;
  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.student_confirm_promotion(p_student_id uuid, p_selected_subjects text[])
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  DECLARE
    v_target_batch text;
    v_inst_id uuid;
    v_new_fee numeric := 0;
    
    -- Variables for Surplus Calculation
    v_old_total numeric;
    v_old_paid numeric;
    v_surplus numeric := 0;
  BEGIN
    -- A. Get Student Info & Current Financial State
    SELECT 
      promotion_target_batch, 
      institute_id,
      total_fee_package,
      paid_amount
    INTO 
      v_target_batch, 
      v_inst_id,
      v_old_total,
      v_old_paid
    FROM students WHERE id = p_student_id;

    IF v_target_batch IS NULL THEN RAISE EXCEPTION 'No target batch found.'; END IF;

    -- B. CALCULATE SURPLUS (The Logic You Requested)
    -- If Paid > Total, the difference is Surplus. Otherwise 0.
    IF v_old_paid > v_old_total THEN
      v_surplus := v_old_paid - v_old_total;
    ELSE
      v_surplus := 0;
    END IF;

    -- C. CALCULATE NEW FEE (Sum of Selected Subjects from 'subjects' table)
    SELECT COALESCE(SUM(default_fee), 0) INTO v_new_fee
    FROM subjects
    WHERE institute_id = v_inst_id 
    AND batch_name = v_target_batch
    AND name = ANY(p_selected_subjects);

    -- D. UPDATE THE STUDENT
    UPDATE students
    SET
      batch_name = v_target_batch,      -- Move to new batch
      enrolled_subjects = p_selected_subjects, -- Set new subjects
      total_fee_package = v_new_fee,    -- Set calculated fee
      
      paid_amount = v_surplus,          -- <--- APPLY SURPLUS HERE (Starts with credit)
      
      pending_payment = 0,
      last_payment_status = 'approved',
      is_promoting = false,
      promotion_target_batch = NULL
    WHERE id = p_student_id;

    -- E. SYNC ATTENDANCE FILTER TABLE
    DELETE FROM student_subjects WHERE student_id = p_student_id;
    
    INSERT INTO student_subjects (institute_id, student_id, subject_name, batch_name)
    SELECT v_inst_id, p_student_id, unnest(p_selected_subjects), v_target_batch;

  END;
  $function$;

  CREATE OR REPLACE FUNCTION public.student_discontinue(p_student_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
  BEGIN
    UPDATE students
    SET
      batch_name = 'Discontinued', -- Move to trash bin
      is_promoting = false,
      promotion_target_batch = NULL
    WHERE id = p_student_id;
  END;
  $function$;


  -- TRIGGERS

  -- Auto-update timestamps
  CREATE TRIGGER tr_update_app_settings_timestamp
    BEFORE UPDATE ON public.app_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

  -- Auto-sync batches to subjects
  CREATE TRIGGER tr_sync_students_batch
    AFTER INSERT OR UPDATE OF batch_name ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.sync_batch_to_subjects();

-- ENABLE ROW LEVEL SECURITY
  ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.exam_marks ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.institutes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fees_structure ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;

  -- CREATE POLICIES

  CREATE POLICY "Tenant Isolation" ON public.profiles AS PERMISSIVE FOR ALL TO public USING ((id = auth.uid()));

  CREATE POLICY "Tenant Isolation" ON public.attendance AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.subjects AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.tests AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.exam_marks AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.app_settings AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Student Portal View Institute" ON public.institutes AS PERMISSIVE FOR SELECT TO public USING (true);

  CREATE POLICY "Tenant Isolation" ON public.institutes AS PERMISSIVE FOR ALL TO public USING ((id = get_my_institute_id()));

  CREATE POLICY "View Requests" ON public.payment_requests AS PERMISSIVE FOR SELECT TO public USING ((institute_id = get_my_institute_id()));

  CREATE POLICY "Manage Requests" ON public.payment_requests AS PERMISSIVE FOR UPDATE TO public USING ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.students AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  CREATE POLICY "Public can view institute settings" ON public.app_settings AS PERMISSIVE FOR SELECT TO public USING (true);

  CREATE POLICY "Admins can view their institute requests" ON public.payment_requests AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IN ( SELECT profiles.id FROM profiles WHERE (profiles.institute_id = payment_requests.institute_id))));

  CREATE POLICY "Admins can update their institute requests" ON public.payment_requests AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() IN ( SELECT profiles.id FROM profiles WHERE (profiles.institute_id = payment_requests.institute_id))));

  CREATE POLICY "Admins can update students" ON public.students AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() IN ( SELECT profiles.id FROM profiles WHERE ((profiles.institute_id = students.institute_id) AND (profiles.role = 'admin'::text)))));

  CREATE POLICY "Enable all access for authenticated users" ON public.fees_structure AS PERMISSIVE FOR ALL TO public USING ((auth.role() = 'authenticated'::text));

  CREATE POLICY "Tenant Isolation" ON public.fees_structure AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id()));

  CREATE POLICY "Tenant Isolation" ON public.student_subjects AS PERMISSIVE FOR ALL TO public USING ((institute_id = get_my_institute_id())) WITH CHECK ((institute_id = get_my_institute_id()));

  