import React, { useState } from 'react';
import { useListMyServices, useCreateService, useUpdateService } from '@workspace/api-client-react';
import { Plus, Clock, Edit2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function PortalServices() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMyServices({
    query: { queryKey: ['my-services'] }
  });
  const createService = useCreateService();
  const updateService = useUpdateService();

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ title: '', price: '', duration: '60', description: '' });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.price || !formData.duration) return;

    createService.mutate(
      {
        data: {
          title: formData.title,
          priceCents: Math.round(parseFloat(formData.price) * 100),
          durationMinutes: parseInt(formData.duration, 10),
          description: formData.description,
          isActive: true
        }
      },
      {
        onSuccess: () => {
          toast.success('Service added');
          setIsAdding(false);
          setFormData({ title: '', price: '', duration: '60', description: '' });
          queryClient.invalidateQueries({ queryKey: ['my-services'] });
        }
      }
    );
  };

  const toggleStatus = (id: number, currentActive: boolean) => {
    updateService.mutate(
      { serviceId: id, data: { isActive: !currentActive } },
      {
        onSuccess: () => {
          toast.success(`Service ${!currentActive ? 'activated' : 'deactivated'}`);
          queryClient.invalidateQueries({ queryKey: ['my-services'] });
        }
      }
    );
  };

  return (
    <div className="p-6 pt-10 pb-32 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-serif font-bold text-foreground">Services</h1>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="w-10 h-10 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {isAdding && (
        <div className="bg-card border-2 border-primary/20 rounded-3xl p-5 mb-6 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10" />
          <h2 className="font-serif font-semibold text-lg mb-4">Add New Service</h2>
          <form onSubmit={handleSave} className="space-y-4 relative z-10">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <input 
                required
                value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
                placeholder="e.g. Diabetic Foot Care"
              />
            </div>
            <div className="flex gap-4">
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Price ($)</label>
                <input 
                  required type="number" step="0.01" min="0"
                  value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
                  placeholder="85.00"
                />
              </div>
              <div className="space-y-1.5 flex-1">
                <label className="text-xs font-medium text-muted-foreground">Duration (min)</label>
                <input 
                  required type="number" step="15" min="15"
                  value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none" 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <textarea 
                value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-3 py-2.5 rounded-xl bg-secondary/50 border border-border focus:ring-2 focus:ring-primary focus:outline-none resize-none" 
                rows={2}
                placeholder="Briefly describe what this includes..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                type="button" onClick={() => setIsAdding(false)}
                className="flex-1 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button 
                type="submit" disabled={createService.isPending}
                className="flex-1 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl flex justify-center items-center"
              >
                {createService.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Service'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-3xl animate-pulse" />)
        ) : data?.services.length === 0 ? (
           <div className="text-center py-10 bg-card rounded-3xl border border-dashed border-border">
             <p className="text-muted-foreground font-medium">You haven't added any services yet.</p>
           </div>
        ) : (
          data?.services.map(service => (
            <div key={service.id} className={`bg-card border-2 rounded-3xl p-5 transition-all ${service.isActive ? 'border-border' : 'border-border/50 opacity-60'}`}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-serif font-bold text-lg text-foreground leading-tight">{service.title}</h3>
                <span className="font-serif font-bold text-xl text-primary shrink-0 ml-4">${(service.priceCents / 100).toFixed(2)}</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium mb-3">
                <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5" />
                  {service.durationMinutes} min
                </div>
                <div className="flex items-center gap-1.5">
                  {service.isActive ? (
                    <><CheckCircle2 className="w-4 h-4 text-primary" /> Active</>
                  ) : (
                    <><XCircle className="w-4 h-4 text-muted-foreground" /> Inactive</>
                  )}
                </div>
              </div>
              
              {service.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{service.description}</p>
              )}
              
              <div className="flex justify-end pt-3 border-t border-border mt-auto">
                <button 
                  onClick={() => toggleStatus(service.id, service.isActive)}
                  className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${service.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`}
                >
                  {service.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
