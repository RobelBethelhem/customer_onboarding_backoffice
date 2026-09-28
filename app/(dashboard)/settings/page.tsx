'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  User, Bell, Shield, Database, Save, Eye, EyeOff,
  Workflow, Zap, UserCheck, AlertCircle, CheckCircle2,
  Info, Loader2, RefreshCw, Gift, Plus, Trash2
} from 'lucide-react';
import { useAuth, UserRole } from '@/components/AuthProvider';

interface WorkflowSettings {
  mode: 'auto' | 'manual';
  autoApprovalEnabled: boolean;
  minFaceMatchScore: number;
  requireManualReviewAbove: number;
  notifyOnAutoApproval: boolean;
  notifyOnManualRequired: boolean;
  flexcubeEnabled: boolean;
  flexcubeCustomerServiceUrl: string;
  flexcubeAccountServiceUrl: string;
  flexcubeUserId: string;
  flexcubeSource: string;
  flexcubeBranch: string;
  flexcubeTimeout: number;
  flexcubeEndpoint: string;
}

interface ReferralSettings {
  enabled: boolean;
  maxLevels: number;
  levelRewards: Array<{ level: number; points: number }>;
  pointsToEtbRate: number;
  minRedeemablePoints: number;
  referralExpiryDays: number;
  maxReferralsPerCustomer: number;
  refereePointsEnabled: boolean;
  refereePoints: number;
  webAppBaseUrl: string;
}

const defaultReferralSettings: ReferralSettings = {
  enabled: true,
  maxLevels: 1,
  levelRewards: [{ level: 1, points: 100 }],
  pointsToEtbRate: 1.0,
  minRedeemablePoints: 100,
  referralExpiryDays: 90,
  maxReferralsPerCustomer: 0,
  refereePointsEnabled: false,
  refereePoints: 0,
  webAppBaseUrl: 'http://localhost:3000',
};

const defaultWorkflowSettings: WorkflowSettings = {
  mode: 'manual',
  autoApprovalEnabled: false,
  minFaceMatchScore: 85,
  requireManualReviewAbove: 100000,
  notifyOnAutoApproval: true,
  notifyOnManualRequired: true,
  flexcubeEnabled: true,
  flexcubeCustomerServiceUrl: 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
  flexcubeAccountServiceUrl: 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
  flexcubeUserId: 'FYDA_USR',
  flexcubeSource: 'EXTFYDA',
  flexcubeBranch: '103',
  flexcubeTimeout: 30000,
  flexcubeEndpoint: 'http://localhost:5000/api/flexcube/create-customer',
};

const allTabs: Array<{ id: string; label: string; icon: any; roles: UserRole[] }> = [
  { id: 'workflow', label: 'KYC Workflow', icon: Workflow, roles: ['admin', 'kyc'] },
  { id: 'referral', label: 'Referral Program', icon: Gift, roles: ['admin', 'marketing'] },
  { id: 'profile', label: 'Profile', icon: User, roles: ['admin', 'kyc'] },
  { id: 'notifications', label: 'Notifications', icon: Bell, roles: ['admin', 'kyc'] },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const visibleTabs = useMemo(() =>
    allTabs.filter(tab => user && tab.roles.includes(user.role)),
    [user]
  );

  const defaultTab = visibleTabs.length > 0 ? visibleTabs[0].id : 'workflow';
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState({
    adminName: 'Admin User',
    email: 'admin@zemenbank.com',
    phone: '+251911234567',
    notifications: {
      newApplications: true,
      approvals: true,
      rejections: false,
      dailyReport: true,
      autoApprovalAlerts: true,
    },
    security: {
      twoFactor: true,
      sessionTimeout: '30',
    },
  });

  const [workflowSettings, setWorkflowSettings] = useState<WorkflowSettings>(defaultWorkflowSettings);
  const [referralSettings, setReferralSettings] = useState<ReferralSettings>(defaultReferralSettings);
  const [referralSaveStatus, setReferralSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load workflow settings from MongoDB API on mount
  useEffect(() => {
    fetchWorkflowSettings();
    fetchReferralSettings();
  }, []);

  async function fetchWorkflowSettings() {
    try {
      setLoading(true);
      const response = await fetch('/api/workflow');
      const data = await response.json();

      if (data.success && data.data) {
        setWorkflowSettings({
          mode: data.data.mode || 'manual',
          autoApprovalEnabled: data.data.autoApprovalEnabled || false,
          minFaceMatchScore: data.data.minFaceMatchScore || 85,
          requireManualReviewAbove: data.data.requireManualReviewAbove || 100000,
          notifyOnAutoApproval: data.data.notifyOnAutoApproval ?? true,
          notifyOnManualRequired: data.data.notifyOnManualRequired ?? true,
          flexcubeEnabled: data.data.flexcubeEnabled ?? true,
          flexcubeCustomerServiceUrl: data.data.flexcubeCustomerServiceUrl || 'http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService',
          flexcubeAccountServiceUrl: data.data.flexcubeAccountServiceUrl || 'http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService',
          flexcubeUserId: data.data.flexcubeUserId || 'FYDA_USR',
          flexcubeSource: data.data.flexcubeSource || 'EXTFYDA',
          flexcubeBranch: data.data.flexcubeBranch || '103',
          flexcubeTimeout: data.data.flexcubeTimeout || 30000,
          flexcubeEndpoint: data.data.flexcubeEndpoint || 'http://localhost:5000/api/flexcube/create-customer',
        });
      }
    } catch (err) {
      console.error('Failed to fetch workflow settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    setSaveStatus('saving');

    try {
      const response = await fetch('/api/workflow', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...workflowSettings,
          updatedBy: settings.email,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Failed to save workflow settings:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleWorkflowModeChange = (mode: 'auto' | 'manual') => {
    setWorkflowSettings({
      ...workflowSettings,
      mode,
      autoApprovalEnabled: mode === 'auto',
    });
  };

  async function fetchReferralSettings() {
    try {
      const response = await fetch('/api/referrals/config');
      const data = await response.json();
      if (data.success && data.data) {
        setReferralSettings({
          enabled: data.data.enabled ?? true,
          maxLevels: data.data.maxLevels ?? 1,
          levelRewards: data.data.levelRewards?.length > 0
            ? data.data.levelRewards
            : [{ level: 1, points: 100 }],
          pointsToEtbRate: data.data.pointsToEtbRate ?? 1.0,
          minRedeemablePoints: data.data.minRedeemablePoints ?? 100,
          referralExpiryDays: data.data.referralExpiryDays ?? 90,
          maxReferralsPerCustomer: data.data.maxReferralsPerCustomer ?? 0,
          refereePointsEnabled: data.data.refereePointsEnabled ?? false,
          refereePoints: data.data.refereePoints ?? 0,
          webAppBaseUrl: data.data.webAppBaseUrl || 'http://localhost:3000',
        });
      }
    } catch (err) {
      console.error('Failed to fetch referral settings:', err);
    }
  }

  async function handleSaveReferral() {
    setReferralSaveStatus('saving');
    try {
      const response = await fetch('/api/referrals/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...referralSettings,
          updatedBy: settings.email,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setReferralSaveStatus('saved');
        setTimeout(() => setReferralSaveStatus('idle'), 2000);
      } else {
        setReferralSaveStatus('error');
        setTimeout(() => setReferralSaveStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Failed to save referral settings:', err);
      setReferralSaveStatus('error');
      setTimeout(() => setReferralSaveStatus('idle'), 3000);
    }
  }

  function addLevelReward() {
    const nextLevel = referralSettings.levelRewards.length + 1;
    if (nextLevel > 10) return;
    setReferralSettings({
      ...referralSettings,
      levelRewards: [...referralSettings.levelRewards, { level: nextLevel, points: Math.max(10, Math.floor(100 / nextLevel)) }],
      maxLevels: Math.max(referralSettings.maxLevels, nextLevel),
    });
  }

  function removeLevelReward(index: number) {
    if (referralSettings.levelRewards.length <= 1) return;
    const newRewards = referralSettings.levelRewards.filter((_, i) => i !== index);
    setReferralSettings({
      ...referralSettings,
      levelRewards: newRewards,
      maxLevels: newRewards.length,
    });
  }

  function updateLevelRewardPoints(index: number, points: number) {
    const newRewards = [...referralSettings.levelRewards];
    newRewards[index] = { ...newRewards[index], points };
    setReferralSettings({ ...referralSettings, levelRewards: newRewards });
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Loading workflow settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your account and KYC workflow settings</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchWorkflowSettings}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
              saveStatus === 'saved'
                ? 'bg-green-600 text-white'
                : saveStatus === 'error'
                ? 'bg-red-600 text-white'
                : saveStatus === 'saving'
                ? 'bg-gray-400 text-white cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-4 h-4" />
                Error
              </>
            ) : saveStatus === 'saving' ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-8">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-4 px-1 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Workflow Settings Tab */}
      {activeTab === 'workflow' && (
        <div className="space-y-6">
          {/* API Endpoint Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Mobile App Integration Endpoint</p>
                <p className="text-sm text-blue-700 mt-1 font-mono bg-blue-100 px-2 py-1 rounded inline-block">
                  POST /api/onboarding
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  Mobile app should submit customer data to this endpoint. The workflow settings below determine whether customers are auto-approved or sent for manual review.
                </p>
              </div>
            </div>
          </div>

          {/* Workflow Mode Selection */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Workflow className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">KYC Workflow Mode</h2>
                <p className="text-sm text-gray-500">Choose how customer applications are processed</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Auto Approval Mode */}
              <button
                onClick={() => handleWorkflowModeChange('auto')}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  workflowSettings.mode === 'auto'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                {workflowSettings.mode === 'auto' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                )}
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Auto Approval</h3>
                <p className="text-sm text-gray-600 mb-4">
                  System automatically creates customer accounts via FlexCube web service after successful verification.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Instant account creation</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>No manual intervention required</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Records visible in Auto Approved list</span>
                  </div>
                </div>
              </button>

              {/* Manual Approval Mode */}
              <button
                onClick={() => handleWorkflowModeChange('manual')}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  workflowSettings.mode === 'manual'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                {workflowSettings.mode === 'manual' && (
                  <div className="absolute top-4 right-4">
                    <CheckCircle2 className="w-6 h-6 text-blue-500" />
                  </div>
                )}
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <UserCheck className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Manual Approval</h3>
                <p className="text-sm text-gray-600 mb-4">
                  KYC officer reviews applications and verification photos before approving account creation.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Human verification of photos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Review Fayda vs liveness photos</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Full audit trail</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Current Mode Banner */}
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
              workflowSettings.mode === 'auto' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'
            }`}>
              <Info className={`w-5 h-5 mt-0.5 ${workflowSettings.mode === 'auto' ? 'text-green-600' : 'text-blue-600'}`} />
              <div>
                <p className={`font-medium ${workflowSettings.mode === 'auto' ? 'text-green-900' : 'text-blue-900'}`}>
                  Current Mode: {workflowSettings.mode === 'auto' ? 'Auto Approval' : 'Manual Approval'}
                </p>
                <p className={`text-sm mt-1 ${workflowSettings.mode === 'auto' ? 'text-green-700' : 'text-blue-700'}`}>
                  {workflowSettings.mode === 'auto'
                    ? 'New applications will be automatically sent to FlexCube web service after successful face verification. View results in the Auto Approved section.'
                    : 'New applications will appear in the Pending Review section. KYC officers must review verification photos and manually approve before account creation.'
                  }
                </p>
              </div>
            </div>

            {/* Channel-Based Approval Note */}
            <div className="mt-4 p-4 rounded-xl flex items-start gap-3 bg-violet-50 border border-violet-200">
              <Shield className="w-5 h-5 mt-0.5 text-violet-600" />
              <div>
                <p className="font-medium text-violet-900">Channel-Based Approval Rules</p>
                <p className="text-sm mt-1 text-violet-700">
                  The workflow mode above applies <span className="font-semibold">only to Mobile App</span> channel submissions (which include live liveness verification).
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-violet-700">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Mobile App</span>
                    <span>→ Uses the workflow mode selected above ({workflowSettings.mode === 'auto' ? 'Auto Approval' : 'Manual Approval'})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-violet-700">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Web</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">WhatsApp</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-700">Telegram</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">SuperApp</span>
                    <span>→ <span className="font-semibold">Always Manual Approval</span></span>
                  </div>
                </div>
                <p className="text-xs mt-3 text-violet-600">
                  Non-mobile channels submit a recorded face video instead of live liveness verification. KYC officers must review the video and photos before approving.
                </p>
              </div>
            </div>
          </div>

          {/* Auto Approval Settings */}
          {workflowSettings.mode === 'auto' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Auto Approval Settings</h2>
              </div>

              <div className="space-y-6">
                {/* Face Match Score Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Face Match Score
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={workflowSettings.minFaceMatchScore}
                      onChange={(e) => setWorkflowSettings({
                        ...workflowSettings,
                        minFaceMatchScore: parseInt(e.target.value),
                      })}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
                    />
                    <span className="w-16 px-3 py-2 bg-gray-100 rounded-lg text-center font-medium">
                      {workflowSettings.minFaceMatchScore}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Applications with face match score below this threshold will require manual review
                  </p>
                </div>

                {/* Initial Deposit Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Manual Review Required Above (ETB)
                  </label>
                  <input
                    type="number"
                    value={workflowSettings.requireManualReviewAbove}
                    onChange={(e) => setWorkflowSettings({
                      ...workflowSettings,
                      requireManualReviewAbove: parseInt(e.target.value) || 0,
                    })}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Applications with initial deposit above this amount will require manual review
                  </p>
                </div>

                {/* FlexCube Core Banking SOAP Integration */}
                <div className="pt-4 border-t">
                  <h3 className="font-medium text-gray-900 mb-1">FlexCube Core Banking (SOAP)</h3>
                  <p className="text-sm text-gray-500 mb-4">Connect to Oracle FlexCube Universal Banking for real CIF and Account creation</p>

                  <div className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-gray-900">Enable FlexCube Integration</p>
                      <p className="text-sm text-gray-500">Call FlexCube SOAP webservice for CIF + Account creation</p>
                    </div>
                    <button
                      onClick={() => setWorkflowSettings({
                        ...workflowSettings,
                        flexcubeEnabled: !workflowSettings.flexcubeEnabled,
                      })}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        workflowSettings.flexcubeEnabled ? 'bg-green-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          workflowSettings.flexcubeEnabled ? 'translate-x-7' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {!workflowSettings.flexcubeEnabled && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-700">
                        <span className="font-medium">FlexCube disabled:</span> CIF and Account numbers will be generated locally (not in core banking).
                      </p>
                    </div>
                  )}

                  {workflowSettings.flexcubeEnabled && (
                    <div className="space-y-4 mt-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CIF Service URL (FCUBSCustomerService)
                        </label>
                        <input
                          type="text"
                          value={workflowSettings.flexcubeCustomerServiceUrl}
                          onChange={(e) => setWorkflowSettings({
                            ...workflowSettings,
                            flexcubeCustomerServiceUrl: e.target.value,
                          })}
                          placeholder="http://10.1.1.155:7107/FCUBSCustomerService/FCUBSCustomerService"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account Service URL (FCUBSAccService)
                        </label>
                        <input
                          type="text"
                          value={workflowSettings.flexcubeAccountServiceUrl}
                          onChange={(e) => setWorkflowSettings({
                            ...workflowSettings,
                            flexcubeAccountServiceUrl: e.target.value,
                          })}
                          placeholder="http://10.1.1.155:7107/FCUBSAccService/FCUBSAccService"
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            User ID
                          </label>
                          <input
                            type="text"
                            value={workflowSettings.flexcubeUserId}
                            onChange={(e) => setWorkflowSettings({
                              ...workflowSettings,
                              flexcubeUserId: e.target.value,
                            })}
                            placeholder="FYDA_USR"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Source
                          </label>
                          <input
                            type="text"
                            value={workflowSettings.flexcubeSource}
                            onChange={(e) => setWorkflowSettings({
                              ...workflowSettings,
                              flexcubeSource: e.target.value,
                            })}
                            placeholder="EXTFYDA"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Default Branch
                          </label>
                          <input
                            type="text"
                            value={workflowSettings.flexcubeBranch}
                            onChange={(e) => setWorkflowSettings({
                              ...workflowSettings,
                              flexcubeBranch: e.target.value,
                            })}
                            placeholder="103"
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SOAP Timeout (ms)
                        </label>
                        <input
                          type="number"
                          value={workflowSettings.flexcubeTimeout}
                          onChange={(e) => setWorkflowSettings({
                            ...workflowSettings,
                            flexcubeTimeout: parseInt(e.target.value) || 30000,
                          })}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-700">
                          <span className="font-medium">Flow:</span> CreateCustomer (CIF) → CreateCustAcc (Account). Both calls use SOAP/XML over HTTP to the FlexCube FCUBS endpoints.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                <div className="flex items-center justify-between py-3 border-t">
                  <div>
                    <p className="font-medium text-gray-900">Notify on Auto Approval</p>
                    <p className="text-sm text-gray-500">Send notification when accounts are auto-approved</p>
                  </div>
                  <button
                    onClick={() => setWorkflowSettings({
                      ...workflowSettings,
                      notifyOnAutoApproval: !workflowSettings.notifyOnAutoApproval,
                    })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      workflowSettings.notifyOnAutoApproval ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        workflowSettings.notifyOnAutoApproval ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between py-3 border-t">
                  <div>
                    <p className="font-medium text-gray-900">Notify When Manual Review Required</p>
                    <p className="text-sm text-gray-500">Alert when auto-approval fails and manual review is needed</p>
                  </div>
                  <button
                    onClick={() => setWorkflowSettings({
                      ...workflowSettings,
                      notifyOnManualRequired: !workflowSettings.notifyOnManualRequired,
                    })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      workflowSettings.notifyOnManualRequired ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        workflowSettings.notifyOnManualRequired ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual Approval Info */}
          {workflowSettings.mode === 'manual' && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Manual Approval Process</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                  <div>
                    <p className="font-medium text-gray-900">Customer submits application via mobile app</p>
                    <p className="text-sm text-gray-600">Mobile app sends data to POST /api/onboarding endpoint</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                  <div>
                    <p className="font-medium text-gray-900">Application appears in Pending Review</p>
                    <p className="text-sm text-gray-600">KYC officer can view all submitted information and photos</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                  <div>
                    <p className="font-medium text-gray-900">Photo verification</p>
                    <p className="text-sm text-gray-600">Compare Fayda photo with all 5 liveness verification photos</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                  <div>
                    <p className="font-medium text-gray-900">Approve or Reject</p>
                    <p className="text-sm text-gray-600">Upon approval, account is created via FlexCube web service</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Referral Program Tab */}
      {activeTab === 'referral' && (
        <div className="space-y-6">
          {/* Program Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Gift className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Referral Program</h2>
                  <p className="text-sm text-gray-500">Configure the customer referral reward system</p>
                </div>
              </div>
              <button
                onClick={handleSaveReferral}
                disabled={referralSaveStatus === 'saving'}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-all text-sm ${
                  referralSaveStatus === 'saved'
                    ? 'bg-green-600 text-white'
                    : referralSaveStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : referralSaveStatus === 'saving'
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}
              >
                {referralSaveStatus === 'saved' ? (
                  <><CheckCircle2 className="w-4 h-4" /> Saved!</>
                ) : referralSaveStatus === 'saving' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                ) : (
                  <><Save className="w-4 h-4" /> Save Referral Settings</>
                )}
              </button>
            </div>

            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between py-4 border-b">
              <div>
                <p className="font-medium text-gray-900">Enable Referral Program</p>
                <p className="text-sm text-gray-500">Master switch — when off, no new referrals can be created</p>
              </div>
              <button
                onClick={() => setReferralSettings({ ...referralSettings, enabled: !referralSettings.enabled })}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  referralSettings.enabled ? 'bg-green-600' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  referralSettings.enabled ? 'translate-x-7' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {!referralSettings.enabled && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  <span className="font-medium">Program disabled:</span> Existing referral links will not work and no new rewards will be distributed.
                </p>
              </div>
            )}
          </div>

          {referralSettings.enabled && (
            <>
              {/* Multi-Level Rewards Configuration */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Multi-Level Rewards</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Configure how many levels of referrals earn rewards, and how many points each level gets.
                </p>

                <div className="space-y-3">
                  {referralSettings.levelRewards.map((reward, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-shrink-0">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700'
                          : index === 1 ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-600'
                        }`}>
                          {reward.level}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-700">
                          Level {reward.level} {index === 0 ? '(Direct Referral)' : `(${index + 1} levels deep)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={reward.points}
                          onChange={(e) => updateLevelRewardPoints(index, parseInt(e.target.value) || 0)}
                          min="0"
                          className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="text-sm text-gray-500">points</span>
                      </div>
                      {index > 0 && (
                        <button
                          onClick={() => removeLevelReward(index)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {referralSettings.levelRewards.length < 10 && (
                  <button
                    onClick={addLevelReward}
                    className="mt-3 flex items-center gap-2 px-4 py-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Level {referralSettings.levelRewards.length + 1}
                  </button>
                )}

                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">How it works:</span> If A refers B, and B refers C — when C completes onboarding:
                    B earns Level 1 points ({referralSettings.levelRewards[0]?.points || 0})
                    {referralSettings.levelRewards.length > 1 && `, A earns Level 2 points (${referralSettings.levelRewards[1]?.points || 0})`}
                    {referralSettings.levelRewards.length > 2 && ', and so on up the chain'}.
                  </p>
                </div>
              </div>

              {/* Referee (New Customer) Rewards */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Referee Rewards</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Optionally award points to the new customer (referee) when they complete onboarding through a referral link.
                </p>

                <div className="flex items-center justify-between py-3 border-b mb-4">
                  <div>
                    <p className="font-medium text-gray-700">Award Points to Referee</p>
                    <p className="text-sm text-gray-500">New customers earn points when they sign up via a referral link</p>
                  </div>
                  <button
                    onClick={() => setReferralSettings({ ...referralSettings, refereePointsEnabled: !referralSettings.refereePointsEnabled })}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      referralSettings.refereePointsEnabled ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      referralSettings.refereePointsEnabled ? 'translate-x-7' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {referralSettings.refereePointsEnabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points for Referee
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={referralSettings.refereePoints}
                        onChange={(e) => setReferralSettings({
                          ...referralSettings,
                          refereePoints: parseInt(e.target.value) || 0,
                        })}
                        min="0"
                        className="w-32 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-500">points</span>
                    </div>

                    <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-700">
                        <span className="font-medium">How it works:</span> When a referred customer completes onboarding, they will receive{' '}
                        <span className="font-bold">{referralSettings.refereePoints} points</span> as a welcome bonus
                        ({(referralSettings.refereePoints * referralSettings.pointsToEtbRate).toFixed(2)} ETB equivalent).
                      </p>
                    </div>
                  </div>
                )}

                {!referralSettings.refereePointsEnabled && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-500">
                      Referee rewards are disabled. Only referrers will earn points.
                    </p>
                  </div>
                )}
              </div>

              {/* Points-to-ETB Conversion */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Points Conversion</h3>
                <p className="text-sm text-gray-500 mb-4">Configure how points convert to Ethiopian Birr (ETB)</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Points-to-ETB Rate
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">1 point =</span>
                      <input
                        type="number"
                        value={referralSettings.pointsToEtbRate}
                        onChange={(e) => setReferralSettings({
                          ...referralSettings,
                          pointsToEtbRate: parseFloat(e.target.value) || 0.01,
                        })}
                        step="0.01"
                        min="0.01"
                        className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-sm text-gray-500">ETB</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Redeemable Points
                    </label>
                    <input
                      type="number"
                      value={referralSettings.minRedeemablePoints}
                      onChange={(e) => setReferralSettings({
                        ...referralSettings,
                        minRedeemablePoints: parseInt(e.target.value) || 1,
                      })}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Customers must have at least this many points to convert
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Example:</span> With {referralSettings.levelRewards[0]?.points || 100} points per direct referral and a rate of {referralSettings.pointsToEtbRate} ETB/point, each successful referral earns{' '}
                    <span className="font-bold">{((referralSettings.levelRewards[0]?.points || 100) * referralSettings.pointsToEtbRate).toFixed(2)} ETB</span>.
                  </p>
                </div>
              </div>

              {/* Limits & Expiry */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Limits & Expiry</h3>
                <p className="text-sm text-gray-500 mb-4">Set boundaries for referral usage</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Referral Link Expiry (days)
                    </label>
                    <input
                      type="number"
                      value={referralSettings.referralExpiryDays}
                      onChange={(e) => setReferralSettings({
                        ...referralSettings,
                        referralExpiryDays: parseInt(e.target.value) || 0,
                      })}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">Set to 0 for no expiry</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Referrals Per Customer
                    </label>
                    <input
                      type="number"
                      value={referralSettings.maxReferralsPerCustomer}
                      onChange={(e) => setReferralSettings({
                        ...referralSettings,
                        maxReferralsPerCustomer: parseInt(e.target.value) || 0,
                      })}
                      min="0"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <p className="text-sm text-gray-500 mt-1">Set to 0 for unlimited</p>
                  </div>
                </div>
              </div>

              {/* Web App URL */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="font-semibold text-gray-900 mb-1">Web App Configuration</h3>
                <p className="text-sm text-gray-500 mb-4">Base URL for generating referral links</p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Web App Base URL
                  </label>
                  <input
                    type="text"
                    value={referralSettings.webAppBaseUrl}
                    onChange={(e) => setReferralSettings({
                      ...referralSettings,
                      webAppBaseUrl: e.target.value,
                    })}
                    placeholder="http://localhost:3000"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Referral links will be: <code className="bg-gray-100 px-1 rounded">{referralSettings.webAppBaseUrl}?ref=REF-XXXXXXX</code>
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Profile Settings</h2>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={settings.adminName}
                      onChange={(e) => setSettings({ ...settings, adminName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                    <input
                      type="text"
                      value="KYC Officer"
                      disabled
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value="••••••••••••"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      readOnly
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button className="mt-2 text-sm text-blue-600 hover:text-blue-700">Change Password</button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Security Settings */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-green-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Security</h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">Two-Factor Auth</p>
                    <p className="text-sm text-gray-500">Extra security layer</p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings({
                        ...settings,
                        security: { ...settings.security, twoFactor: !settings.security.twoFactor },
                      })
                    }
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      settings.security.twoFactor ? 'bg-green-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        settings.security.twoFactor ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Timeout (minutes)</label>
                  <select
                    value={settings.security.sessionTimeout}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        security: { ...settings.security, sessionTimeout: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="120">2 hours</option>
                  </select>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-purple-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">System Info</h2>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Version</span>
                  <span className="font-medium text-gray-900">2.1.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Database</span>
                  <span className="font-medium text-green-600">MongoDB Connected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Workflow Mode</span>
                  <span className={`font-medium ${workflowSettings.mode === 'auto' ? 'text-green-600' : 'text-blue-600'}`}>
                    {workflowSettings.mode === 'auto' ? 'Auto' : 'Manual'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">FlexCube CBS</span>
                  <span className={`font-medium ${workflowSettings.flexcubeEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                    {workflowSettings.flexcubeEnabled ? 'SOAP Enabled' : 'Disabled (Local)'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Notification Preferences</h2>
          </div>

          <div className="space-y-4">
            {[
              { key: 'newApplications', label: 'New Applications', desc: 'Get notified when new applications are submitted' },
              { key: 'approvals', label: 'Approvals', desc: 'Get notified when applications are approved' },
              { key: 'rejections', label: 'Rejections', desc: 'Get notified when applications are rejected' },
              { key: 'autoApprovalAlerts', label: 'Auto Approval Alerts', desc: 'Get notified when accounts are auto-approved' },
              { key: 'dailyReport', label: 'Daily Report', desc: 'Receive a daily summary of activities' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="font-medium text-gray-900">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <button
                  onClick={() =>
                    setSettings({
                      ...settings,
                      notifications: {
                        ...settings.notifications,
                        [item.key]: !settings.notifications[item.key as keyof typeof settings.notifications],
                      },
                    })
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.notifications[item.key as keyof typeof settings.notifications]
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      settings.notifications[item.key as keyof typeof settings.notifications]
                        ? 'translate-x-7'
                        : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
