import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Home, ArrowLeft } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFoundPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6">
      <div className="h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
        <AlertCircle className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
        404 - Page Not Found
      </h2>
      <p className="text-sm text-slate-500 max-w-sm mt-2">
        The classroom page or analytics view you are looking for does not exist or has been moved.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Link to="/">
          <Button variant="primary" icon={Home}>
            Return to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
