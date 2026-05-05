import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Home } from 'lucide-react';
import CTAButton from '../components/ui/CTAButton';

function FeaturePlaceholderPage({ title, description }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <div className="border border-neutral-100 p-10">
        <div className="mb-8">
          <h2 className="font-serif text-2xl text-heading mb-2 flex items-center gap-3">
            <Wrench size={24} className="text-muted" />
            {title}
          </h2>
          <p className="font-sans text-body-secondary text-muted">{description}</p>
        </div>

        <div className="border-l-4 border-neutral-900 bg-neutral-50 p-4 mb-8">
          <p className="font-sans text-sm text-body font-medium mb-1">
            当前前端页面已生成，但 Java 后端尚未提供对应接口或仍在迁移中。
          </p>
          <p className="font-sans text-sm text-muted">
            我已经把会直接报错的入口改成了占位页，避免出现 404、跨端口失败或空白页。
          </p>
        </div>

        <div className="flex gap-4">
          <CTAButton onClick={() => navigate('/')}>
            <Home size={16} className="inline mr-2" />
            返回首页
          </CTAButton>
          <CTAButton variant="secondary" onClick={() => navigate('/location-search')}>
            浏览已接通功能
          </CTAButton>
        </div>
      </div>
    </div>
  );
}

export default FeaturePlaceholderPage;
