import React, { useState, useEffect } from 'react';
import { useGetMyProviderProfile, useUpdateMyProviderProfile } from '@workspace/api-client-react';
import { Save, User, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function PortalProfile() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetMyProviderProfile({
    query: { queryKey: ['my-profile'] }
  });
  const updateProfile = useUpdateMyProviderProfile();

  const [formData, setFormData] = useState({
    title: '',
    city: '',
    yearsExperience: '',
    bio: '',
    serviceAreaNotes: '',
    acceptsNewClients: true
  });

  useEffect(() => {
    if (data?.provider) {
      setFormData({
        title: data.provider.title || '',
        city: data.provider.city || '',
        yearsExperience: data.provider.yearsExperience?.toString() || '',
        bio: data.provider.bio || '',
        serviceAreaNotes: data.provider.serviceAreaNotes || '',
        acceptsNewClients: data.provider.acceptsNewClients
      });
    }
  }, [data]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(
      {
        data: {
          title: formData.title,
          city: formData.city,
          yearsExperience: formData.yearsExperience ? parseInt(formData.yearsExperience, 10) : undefined,
          bio: formData.bio,
          serviceAreaNotes: formData.serviceAreaNotes,
          acceptsNewClients: formData.acceptsNewClients
        }
      },
      {
        onSuccess: () => {
          toast.success('Profile updated successfully');
          queryClient.invalidateQueries({ queryKey: ['my-profile'] });
        },
        onError: () => toast.error('Failed to update profile')
      }
    );
  };

  if (isLoading) {
    return <div className="p-6 pt-20 flex justify-center"><div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" /></div>;
  }

  const provider = data?.provider;

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto">
      <h1 className="text-3xl font-serif font-bold text-foreground mb-8">Your Profile</h1>

      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm mb-8">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
            {provider?.avatarUrl ? (
              <img src={provider.avatarUrl} className="w-full h-full object-cover rounded-2xl" alt="" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-serif font-bold text-foreground">
              {provider?.firstName} {provider?.lastName}
            </h2>
            <p className="text-muted-foreground text-sm flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4" /> {formData.city || 'No city set'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Professional Title</label>
            <input 
              value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
              placeholder="e.g. Certified Foot Care Nurse"
            />
          </div>

          <div className="flex gap-4">
            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">City</label>
              <input 
                value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
              />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-sm font-medium text-foreground">Years Exp.</label>
              <input 
                type="number"
                value={formData.yearsExperience} onChange={e => setFormData({...formData, yearsExperience: e.target.value})}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Bio</label>
            <textarea 
              value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none resize-none" 
              rows={4}
              placeholder="Tell clients about your expertise and approach..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Service Area Notes</label>
            <textarea 
              value={formData.serviceAreaNotes} onChange={e => setFormData({...formData, serviceAreaNotes: e.target.value})}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none resize-none" 
              rows={2}
              placeholder="e.g. Serving downtown and north end..."
            />
          </div>

          <div className="flex items-center gap-3 pt-2 pb-4 border-b border-border">
            <input 
              type="checkbox" id="accepts"
              checked={formData.acceptsNewClients}
              onChange={e => setFormData({...formData, acceptsNewClients: e.target.checked})}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary accent-primary"
            />
            <label htmlFor="accepts" className="text-sm font-medium text-foreground cursor-pointer">
              Accepting new clients
            </label>
          </div>

          <button 
            type="submit" disabled={updateProfile.isPending}
            className="w-full py-4 bg-primary text-primary-foreground font-bold text-lg rounded-xl flex items-center justify-center gap-2 hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-70 mt-4"
          >
            {updateProfile.isPending ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> Save Profile</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
