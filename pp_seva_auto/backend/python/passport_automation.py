# passport_automation.py
"""
Full Passport Seva automation (local file mode)

- Loads the local HTML file using file:/// URL (Option B)
- Uses a local chromedriver.exe (no webdriver-manager network download)
- Auto-detects chromedriver under the typical .wdm cache (if present)
- Stops at CAPTCHA for manual input
"""

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time
import os
import glob
import sys

# -----------------------
# CONFIG — EDIT IF NEEDED
# -----------------------

# 1) Local file URL (Option B) - already converted to file:/// form.
website_file = "file:///C:/Users/vinay sai/OneDrive/Desktop/webproj/Autonomous-Agentic-Platform-for-Government-Websites/pp_seva_auto/frontend/mock-passport-website.html"

# 2) If auto-detect fails, optionally override with the absolute path to chromedriver.exe:
#    Example: r"C:\chromedriver\chromedriver.exe"
driver_path_override = None   # <-- set to a string path if you want to force a specific chromedriver

# 3) Timeout config (seconds)
SHORT_WAIT = 10
LONG_WAIT = 60

# -----------------------
# Helper: locate chromedriver
# -----------------------
def find_local_chromedriver():
    """
    Try to find chromedriver.exe automatically:
      - First check override path (if set and exists)
      - Then attempt to search common webdriver-manager (.wdm) cache locations
      - Return absolute path to chromedriver.exe or None
    """
    # 1) override
    if driver_path_override:
        p = os.path.expanduser(driver_path_override)
        if os.path.isfile(p):
            return os.path.abspath(p)
        else:
            print(f"[DriverFinder] Override path set but not found: {p}")

    # 2) typical webdriver-manager cache path for current user
    user_dir = os.path.expanduser("~")
    wdm_base = os.path.join(user_dir, ".wdm", "drivers", "chromedriver", "win64")
    if os.path.isdir(wdm_base):
        # find chromedriver.exe in subfolders - prefer newest by modification time
        pattern = os.path.join(wdm_base, "*", "**", "chromedriver*.exe")
        candidates = glob.glob(pattern, recursive=True)
        if candidates:
            # sort by modified time (descending) and return first
            candidates.sort(key=lambda p: os.path.getmtime(p), reverse=True)
            print(f"[DriverFinder] Found chromedriver candidates in .wdm cache. Using: {candidates[0]}")
            return os.path.abspath(candidates[0])
        else:
            # perhaps stored without "chromedriver*.exe" name (rare). try searching any exe inside subfolders
            pattern2 = os.path.join(wdm_base, "*", "**", "*.exe")
            candidates2 = glob.glob(pattern2, recursive=True)
            if candidates2:
                candidates2.sort(key=lambda p: os.path.getmtime(p), reverse=True)
                print(f"[DriverFinder] Found EXE candidates in .wdm cache. Using: {candidates2[0]}")
                return os.path.abspath(candidates2[0])

    # 3) common fallback locations (just in case user placed driver manually)
    fallback_paths = [
        r"C:\chromedriver\chromedriver.exe",
        os.path.join(os.getcwd(), "chromedriver.exe"),
        os.path.join(user_dir, "chromedriver.exe")
    ]
    for fp in fallback_paths:
        if os.path.isfile(fp):
            print(f"[DriverFinder] Found chromedriver at fallback path: {fp}")
            return os.path.abspath(fp)

    return None

# -----------------------
# PassportAutomation class
# -----------------------
class PassportAutomation:
    def __init__(self, website_url: str):
        self.website_url = website_url
        self.driver = None
        self.wait = None
        self.captcha_code = None
        self._service = None

    def start_browser(self):
        """Start a visible Chrome browser using a local chromedriver executable"""
        print("🌐 Starting Chrome browser (visible)...")

        # find local chromedriver
        driver_exe = find_local_chromedriver()
        if not driver_exe:
            print("\n[ERROR] Could not find chromedriver.exe automatically.")
            print("Please place chromedriver.exe in one of these locations or set driver_path_override at the top of the script:")
            print(" - C:\\Users\\<your-user>\\.wdm\\drivers\\chromedriver\\win64\\<version>\\...\\chromedriver.exe")
            print(" - C:\\chromedriver\\chromedriver.exe")
            print(" - or the current working directory")
            raise FileNotFoundError("chromedriver.exe not found. See instructions above.")

        # confirm file exists and is executable
        if not os.path.isfile(driver_exe):
            raise FileNotFoundError(f"chromedriver.exe not found at path: {driver_exe}")

        print(f"[Browser] Using chromedriver: {driver_exe}")

        options = webdriver.ChromeOptions()
        options.add_argument("--start-maximized")
        # keep browser visible to allow manual CAPTCHA input
        # options.add_argument("--disable-blink-features=AutomationControlled")
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)

        # Build service with local chromedriver
        self._service = Service(driver_exe)
        self.driver = webdriver.Chrome(service=self._service, options=options)
        self.wait = WebDriverWait(self.driver, SHORT_WAIT)
        print("✅ Chrome started successfully")

    def navigate_to_website(self):
        print(f"📍 Navigating to: {self.website_url}")
        # Basic check: if using file:// ensure the file exists locally
        if self.website_url.startswith("file:///"):
            # convert file:///C:/path to local path
            local_path = self.website_url.replace("file:///", "")
            # Replace forward slashes if any
            local_path = local_path.replace("/", os.sep)
            if not os.path.isfile(local_path):
                raise FileNotFoundError(f"Local HTML file not found: {local_path}\nDouble-check the website_file variable.")
        self.driver.get(self.website_url)
        # wait for body to be present
        WebDriverWait(self.driver, SHORT_WAIT).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(1)
        print("✅ Page loaded")

    def login(self, email="test@example.com", password="password123"):
        print("🔐 Performing login...")
        try:
            email_input = self.wait.until(EC.presence_of_element_located((By.ID, "loginEmail")))
            password_input = self.driver.find_element(By.ID, "loginPassword")
            login_btn = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

            self._type_slowly(email_input, email, delay=0.05)
            time.sleep(0.3)
            self._type_slowly(password_input, password, delay=0.05)
            time.sleep(0.3)

            login_btn.click()
            time.sleep(1)
            print("✅ Login clicked")
        except Exception as e:
            print(f"❌ Login step failed: {e}")
            raise

    def start_fresh_passport_application(self):
        print("📋 Starting fresh passport application...")
        try:
            cards = self.wait.until(EC.presence_of_all_elements_located((By.CLASS_NAME, "service-card")))
            if not cards:
                raise RuntimeError("No service-card elements found")
            cards[0].click()
            time.sleep(1)
            print("✅ Application started")
        except Exception as e:
            print(f"❌ Start application failed: {e}")
            raise

    def fill_stage1_passport_type(self, applying_for="fresh", application_type="normal", booklet="36"):
        print("📝 Stage 1 — Passport Type")
        try:
            self.driver.find_element(By.CSS_SELECTOR, f'input[name="applyingFor"][value="{applying_for}"]').click()
            time.sleep(0.2)
            self.driver.find_element(By.CSS_SELECTOR, f'input[name="applicationType"][value="{application_type}"]').click()
            time.sleep(0.2)
            self.driver.find_element(By.CSS_SELECTOR, f'input[name="bookletType"][value="{booklet}"]').click()
            time.sleep(0.2)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.6)
            print("✅ Stage 1 completed")
        except Exception as e:
            print(f"❌ Stage 1 failed: {e}")
            raise

    def fill_stage2_applicant_details(self, data: dict):
        print("📝 Stage 2 — Applicant Details")
        try:
            # Basic fields
            for field_id in ["givenName", "surname", "dob", "placeOfBirth"]:
                if data.get(field_id):
                    el = self.driver.find_element(By.ID, field_id)
                    self._type_slowly(el, data[field_id], delay=0.06)
                    print(f"  ✓ {field_id}: {data[field_id]}")
                    time.sleep(0.2)

            # selects
            selects = {
                "gender": data.get("gender", "Male"),
                "maritalStatus": data.get("maritalStatus", "Single"),
                "citizenship": data.get("citizenship", "Birth"),
                "employment": data.get("employment", "Private"),
                "education": data.get("education", "Graduate And Above")
            }
            for sel_id, sel_val in selects.items():
                try:
                    select_el = self.driver.find_element(By.ID, sel_id)
                    if select_el.tag_name == "select":
                        Select(select_el).select_by_value(sel_val)
                        print(f"  ✓ {sel_id}: {sel_val}")
                        time.sleep(0.2)
                except Exception:
                    pass

            # Non-ECR
            try:
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="nonECR"][value="no"]').click()
            except Exception:
                pass

            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 2 completed")
        except Exception as e:
            print(f"❌ Stage 2 failed: {e}")
            raise

    def fill_stage3_family_details(self, data: dict):
        print("📝 Stage 3 — Family Details")
        try:
            for field_id in ["fatherGivenName", "fatherSurname", "motherGivenName", "motherSurname"]:
                if data.get(field_id):
                    el = self.driver.find_element(By.ID, field_id)
                    self._type_slowly(el, data[field_id], delay=0.06)
                    print(f"  ✓ {field_id}: {data[field_id]}")
                    time.sleep(0.2)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 3 completed")
        except Exception as e:
            print(f"❌ Stage 3 failed: {e}")
            raise

    def fill_stage4_address_details(self, data: dict):
        print("📝 Stage 4 — Address Details")
        try:
            try:
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="addressOutIndia"][value="no"]').click()
            except Exception:
                pass
            time.sleep(0.2)

            for field_id in ["houseNo", "city", "pincode", "mobile", "email"]:
                if data.get(field_id):
                    el = self.driver.find_element(By.ID, field_id)
                    self._type_slowly(el, data[field_id], delay=0.06)
                    print(f"  ✓ {field_id}: {data[field_id]}")
                    time.sleep(0.2)

            # state select + try district selection
            try:
                state_sel = self.driver.find_element(By.ID, "state")
                if state_sel.tag_name == "select" and data.get("state"):
                    Select(state_sel).select_by_value(data.get("state"))
                    print(f"  ✓ state: {data.get('state')}")
                    time.sleep(1)
                    try:
                        district_sel = Select(self.driver.find_element(By.ID, "district"))
                        if len(district_sel.options) > 1:
                            district_sel.select_by_index(1)
                            print(f"  ✓ district selected: {district_sel.first_selected_option.text}")
                    except Exception:
                        pass
            except Exception:
                pass

            try:
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="permanentAddress"][value="no"]').click()
            except Exception:
                pass

            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 4 completed")
        except Exception as e:
            print(f"❌ Stage 4 failed: {e}")
            raise

    def fill_stage5_emergency_contact(self, data: dict):
        print("📝 Stage 5 — Emergency Contact")
        try:
            for fid in ["emergencyName", "emergencyMobile", "emergencyAddress"]:
                if data.get(fid):
                    el = self.driver.find_element(By.ID, fid)
                    self._type_slowly(el, data[fid], delay=0.06)
                    print(f"  ✓ {fid}: {data[fid]}")
                    time.sleep(0.2)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 5 completed")
        except Exception as e:
            print(f"❌ Stage 5 failed: {e}")
            raise

    def fill_stage6_previous_passport(self):
        print("📝 Stage 6 — Previous Passport")
        try:
            try:
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="heldPassport"][value="no"]').click()
            except Exception:
                pass
            time.sleep(0.3)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 6 completed")
        except Exception as e:
            print(f"❌ Stage 6 failed: {e}")
            raise

    def fill_stage7_other_details(self):
        print("📝 Stage 7 — Other Details")
        try:
            try:
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="aliases"][value="no"]').click()
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="nameChanged"][value="no"]').click()
                self.driver.find_element(By.CSS_SELECTOR, 'input[name="govServant"][value="no"]').click()
            except Exception:
                pass
            time.sleep(0.3)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 7 completed")
        except Exception as e:
            print(f"❌ Stage 7 failed: {e}")
            raise

    def navigate_stage8_preview(self):
        print("📝 Stage 8 — Preview")
        try:
            time.sleep(1.5)
            self.driver.find_element(By.ID, "nextBtn").click()
            time.sleep(0.8)
            print("✅ Stage 8 completed")
        except Exception as e:
            print(f"❌ Stage 8 failed: {e}")
            raise

    def get_captcha_and_wait(self):
        print("🔐 Stage 9 — CAPTCHA (automation will pause here)")
        try:
            el = WebDriverWait(self.driver, LONG_WAIT).until(
                EC.presence_of_element_located((By.ID, "captchaCode"))
            )
            self.captcha_code = el.text
            print("\n" + "=" * 50)
            print(f"🔐 CAPTCHA CODE (visible on page): {self.captcha_code}")
            print("=" * 50 + "\n")
            print("👉 Automation paused. Enter CAPTCHA manually in the console to continue.")
            return self.captcha_code
        except Exception as e:
            print(f"❌ Failed to read CAPTCHA: {e}")
            raise

    def submit_with_captcha(self, captcha_solution: str):
        print(f"✍️ Entering CAPTCHA: {captcha_solution}")
        try:
            captcha_input = self.driver.find_element(By.ID, "captchaInput")
            captcha_input.clear()
            self._type_slowly(captcha_input, captcha_solution, delay=0.08)
            time.sleep(0.5)
            submit_btn = self.driver.find_element(By.ID, "submitBtn")
            submit_btn.click()
            time.sleep(1.2)
            try:
                ref = self.driver.find_element(By.ID, "refNumber").text
                print(f"🎉 Application Reference: {ref}")
                return ref
            except Exception:
                print("✅ Submitted (no reference element found).")
                return None
        except Exception as e:
            print(f"❌ Submit failed: {e}")
            raise

    def _type_slowly(self, element, text, delay=0.1):
        element.clear()
        for ch in str(text):
            element.send_keys(ch)
            time.sleep(delay)

    def close_browser(self):
        if self.driver:
            try:
                print("🔴 Closing browser...")
                self.driver.quit()
                time.sleep(0.5)
            except Exception:
                pass
            finally:
                self.driver = None
                print("✅ Browser closed")

    def automate_fresh_passport(self, user_data: dict, stop_at_captcha: bool = True):
        try:
            self.start_browser()
            self.navigate_to_website()
            self.login(email=user_data.get("email", "test@example.com"), password=user_data.get("password", "password123"))
            self.start_fresh_passport_application()
            self.fill_stage1_passport_type()
            self.fill_stage2_applicant_details(user_data)
            self.fill_stage3_family_details(user_data)
            self.fill_stage4_address_details(user_data)
            self.fill_stage5_emergency_contact(user_data)
            self.fill_stage6_previous_passport()
            self.fill_stage7_other_details()
            self.navigate_stage8_preview()
            captcha = self.get_captcha_and_wait()
            if stop_at_captcha:
                return captcha
            # if not stopping at captcha, you'd call submit_with_captcha(captcha_solution) here
        except Exception as e:
            print(f"\n❌ AUTOMATION FAILED: {e}")
            self.close_browser()
            raise

# -----------------------
# Example usage (run as script)
# -----------------------
if __name__ == "__main__":
    sample_user = {
        "email": "vinay@example.com",
        "password": "password123",
        "givenName": "Vinay Kumar",
        "surname": "Myneni",
        "gender": "Male",
        "dob": "1995-08-15",
        "placeOfBirth": "Tirupati",
        "maritalStatus": "Single",
        "citizenship": "Birth",
        "employment": "Private",
        "education": "Graduate And Above",
        "fatherGivenName": "Father Name",
        "fatherSurname": "Father Surname",
        "motherGivenName": "Mother Name",
        "motherSurname": "Mother Surname",
        "houseNo": "123 Main Street",
        "city": "Tirupati",
        "pincode": "517501",
        "state": "AP",
        "mobile": "9876543210",
        "email": "vinay@example.com",
        "emergencyName": "Emergency Contact",
        "emergencyMobile": "9876543211",
        "emergencyAddress": "Emergency Address"
    }

    print("\n=== Passport Automation (Local file mode) ===\n")
    print("[Note] Website file used:", website_file, "\n")

    automation = PassportAutomation(website_url=website_file)

    try:
        captcha_code = automation.automate_fresh_passport(sample_user, stop_at_captcha=True)
        if captcha_code:
            print("\nPlease enter CAPTCHA shown in the browser (or above):")
            user_input = input("CAPTCHA > ").strip()
            automation.submit_with_captcha(user_input)
            print("\nAutomation finished — keeping browser open for 5 seconds...")
            time.sleep(5)
    finally:
        automation.close_browser()
        print("\nDone.")
