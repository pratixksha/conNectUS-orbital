import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';

const INTERESTS = [
  'AI & Tech', 'Badminton', 'Startups', 'Supper runs',
  'Gaming', 'Photography', 'Study groups', 'Travel',
  'Music', 'Running', 'Hackathons', 'Film',
  'Cooking', 'Volunteering', 'Finance', 'Design',
];

const FACULTIES = [
  'Arts & Social Sciences',
  'Business',
  'Computing',
  'Dentistry',
  'Design & Engineering',
  'Law',
  'Medicine',
  'Music',
  'Science',
];

const YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Graduate', 'Exchange'];

const GOALS = [
  'Find study partners',
  'Meet new friends',
  'Explore internships',
  'Join clubs & communities',
  'Exchange student looking to connect',
];

// helpers 

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function PickerField({ label, options, value, onSelect, placeholder }) {
  const [open, setOpen] = useState(false);
  return (
    <Field label={label}>
      <TouchableOpacity style={styles.input} onPress={() => setOpen(!open)}>
        <Text style={value ? styles.inputText : styles.placeholder}>
          {value || placeholder}
        </Text>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={styles.dropdownItem}
              onPress={() => { onSelect(opt); setOpen(false); }}
            >
              <Text style={styles.dropdownText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </Field>
  );
}

// Main Screen

export default function AuthScreen({ navigation = null }) {
  const [screen, setScreen] = useState('home'); // 'home' | 'login' | 'signup' | 'success'
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Signup
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [name, setName] = useState('');
  const [faculty, setFaculty] = useState('');
  const [year, setYear] = useState('');
  const [goal, setGoal] = useState('');
  const [interests, setInterests] = useState([]);

  function isNUSEmail(e) {
    return e.endsWith('@u.nus.edu') || e.endsWith('@nus.edu.sg');
  }

  /* Tap a chip that's not selected → add it to the array
     Tap a chip that's already selected → remove it from the array */  
  function toggleInterest(item) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  }

  // Login 
  async function handleLogin() {
    if (!loginEmail || !loginPw) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    if (!isNUSEmail(loginEmail)) {
      Alert.alert('NUS email required', 'Please use your @u.nus.edu or @nus.edu.sg email.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPw,
    });
    setLoading(false);
    if (error) {
      Alert.alert('Login failed', error.message);
    } else {
      //console.log('logged in!');
      //router.push('/events');
      router.replace('/home');
    }
  }

  // Signup steps 
  function goStep2() {
    if (!email || !pw || !pw2) { Alert.alert('Missing fields', 'Please fill in all fields.'); return; }
    if (!isNUSEmail(email)) { Alert.alert('NUS email required', 'Please use your @u.nus.edu or @nus.edu.sg email.'); return; }
    if (pw.length < 8) { Alert.alert('Weak password', 'Password must be at least 8 characters.'); return; }
    if (pw !== pw2) { Alert.alert('Passwords do not match', 'Please re-enter your password.'); return; }
    setStep(2);
  }

  function goStep3() {
    if (!name || !faculty || !year || !goal) { Alert.alert('Missing fields', 'Please complete all fields.'); return; }
    setStep(3);
  }

  async function handleSignup() {
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({ email, password: pw });
    if (error) { setLoading(false); Alert.alert('Signup failed', error.message); return; }
    const userId = data?.user?.id;
    if (userId) {
      await supabase.from('profiles').insert({
        id: userId,
        full_name: name,
        faculty,
        year,
        networking_goal: goal,
        interests,
      });
    }
    setLoading(false);
    setScreen('success');
  }

  // Screens 

  // Home — choose login or signup
  if (screen === 'home') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.logo}>
            con<Text style={styles.logoN}>N</Text>ect<Text style={styles.logoUS}>US</Text>
          </Text>
          <Text style={styles.tagline}>Connect with NUS students</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreen('login')}>
            <Text style={styles.primaryBtnText}>Log in</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={() => setScreen('signup')}>
            <Text style={styles.secondaryBtnText}>Create account</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Login
  if (screen === 'login') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setScreen('home')} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Log in</Text>

            <Field label="NUS Email">
              <TextInput
                style={styles.input}
                placeholder="e1234567@u.nus.edu"
                placeholderTextColor="#aaa"
                value={loginEmail}
                onChangeText={setLoginEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>

            <Field label="Password">
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#aaa"
                value={loginPw}
                onChangeText={setLoginPw}
                secureTextEntry
              />
            </Field>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleLogin}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Log in</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setScreen('signup')} style={styles.switchLink}>
              <Text style={styles.switchText}>Don't have an account? Sign up</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Signup
  if (screen === 'signup') {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => step === 1 ? setScreen('home') : setStep(step - 1)} style={styles.back}>
              <Text style={styles.backText}>← Back</Text>
            </TouchableOpacity>

            <Text style={styles.title}>
              {step === 1 ? 'Create account' : step === 2 ? 'Your profile' : 'Your interests'}
            </Text>
            <Text style={styles.stepText}>Step {step} of 3</Text>

            {/* Step 1 */}
            {step === 1 && (
              <View>
                <Field label="NUS Email">
                  <TextInput
                    style={styles.input}
                    placeholder="e1234567@u.nus.edu"
                    placeholderTextColor="#aaa"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </Field>
                <Field label="Password">
                  <TextInput
                    style={styles.input}
                    placeholder="Min. 8 characters"
                    placeholderTextColor="#aaa"
                    value={pw}
                    onChangeText={setPw}
                    secureTextEntry
                  />
                </Field>
                <Field label="Confirm Password">
                  <TextInput
                    style={styles.input}
                    placeholder="Repeat password"
                    placeholderTextColor="#aaa"
                    value={pw2}
                    onChangeText={setPw2}
                    secureTextEntry
                  />
                </Field>
                <TouchableOpacity style={styles.primaryBtn} onPress={goStep2}>
                  <Text style={styles.primaryBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <View>
                <Field label="Full Name">
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor="#aaa"
                    value={name}
                    onChangeText={setName}
                  />
                </Field>
                <PickerField label="Faculty" options={FACULTIES} value={faculty} onSelect={setFaculty} placeholder="Select faculty..." />
                <PickerField label="Year" options={YEARS} value={year} onSelect={setYear} placeholder="Select year..." />
                <PickerField label="Networking Goal" options={GOALS} value={goal} onSelect={setGoal} placeholder="What brings you here?" />
                <TouchableOpacity style={styles.primaryBtn} onPress={goStep3}>
                  <Text style={styles.primaryBtnText}>Next</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <View>
                <Text style={styles.label}>Pick your interests</Text>
                <View style={styles.chipsGrid}>
                  {INTERESTS.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.chip, interests.includes(item) && styles.chipSelected]}
                      onPress={() => toggleInterest(item)}
                    >
                      <Text style={[styles.chipText, interests.includes(item) && styles.chipTextSelected]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleSignup}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Create account</Text>}
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity onPress={() => setScreen('login')} style={styles.switchLink}>
              <Text style={styles.switchText}>Already have an account? Log in</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // Success
  if (screen === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.tagline}>Your profile has been created successfully.</Text>
          <TouchableOpacity style={[styles.primaryBtn, { marginTop: 24 }]} onPress={() => { setScreen('login'); setStep(1); }}>
            <Text style={styles.primaryBtnText}>Go to Log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
}

// Styles 
const styles = StyleSheet.create({
  //outermost wrapper, full white screen
  container: { flex: 1, backgroundColor: '#fff' },

  // centers content vertically and horizontally, used on home and success screens
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  // padding inside the scrollable area on login/signup screens
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },

  logo: { fontSize: 36, fontWeight: '700', color: '#307af3ff', marginBottom: 8 },
  logoN: { color: '#FB923C' },
  logoUS: { color: '#FB923C' },

  // the grey subtitle "Connect with NUS students"
  tagline: { fontSize: 15, color: '#888', marginBottom: 40, textAlign: 'center' },

  // large bold heading like "Log in" or "Create account"
  title: { fontSize: 26, fontWeight: '700', color: '#111', marginBottom: 4 },

  // small grey "Step 1 of 3" text
  stepText: { fontSize: 13, color: '#aaa', marginBottom: 24 },

  // wrapper around the back button
  back: { marginBottom: 24 },
  // text in back button
  backText: { fontSize: 15, color: '#3B82F6' },

  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#444', marginBottom: 6 },

  // wrapper around each label + input pair
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // the small grey text above each input like "NUS Email"
  inputText: { fontSize: 15, color: '#111' },

  // the grey hint text inside picker field before something is selected
  placeholder: { fontSize: 15, color: '#aaa' },

  // the ▼ arrow inside the picker dropdown
  chevron: { fontSize: 10, color: '#aaa' },

  // the list box that appears below the picker
  dropdown: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },

  // each individual row in the dropdown
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownText: { fontSize: 15, color: '#111' },

  // the main solid blue button
  primaryBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // the outlined button on the home screen
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
  },
  secondaryBtnText: { color: '#111', fontSize: 16, fontWeight: '500' },

  // wrapper around the "Already have an account?" link
  switchLink: { alignItems: 'center', marginTop: 20 },
  // the blue link text itself
  switchText: { fontSize: 14, color: '#3B82F6' },

  // the wrapping container that holds all chips in rows
  chipsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24, marginTop: 8 },
  // each individual unselected interest tag
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  chipSelected: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  chipText: { fontSize: 13, color: '#666' },
  chipTextSelected: { color: '#3B82F6', fontWeight: '500' },
});
