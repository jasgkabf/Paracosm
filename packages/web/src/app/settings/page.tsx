"use client";

import { AppLayout } from "@/components/layout/app-layout";
import { useRouter } from "next/navigation";
import { IconBrain, IconCpu, IconKey, IconShield, IconUser } from "@/components/icons";
import { Card } from "@/components/common/card";

export default function SettingsPage() {
  const router = useRouter();

  const sections = [
    {
      title: "LLM Configuration",
      description: "Configure language model providers and API keys",
      href: "/settings/llm",
      icon: IconBrain,
      color: "text-paracosm-green",
    },
    {
      title: "Custom LLM",
      description: "Add and configure custom LLM providers",
      href: "/settings/custom-llm",
      icon: IconCpu,
      color: "text-paracosm-cyan",
    },
    {
      title: "Routing",
      description: "Configure model routing and fallback chains",
      href: "/settings/routing",
      icon: IconShield,
      color: "text-paracosm-purple",
    },
    {
      title: "Budget",
      description: "Set spending limits and track token usage",
      href: "/settings/budget",
      icon: IconKey,
      color: "text-paracosm-yellow",
    },
    {
      title: "Personas",
      description: "Manage agent personas and their configurations",
      href: "/settings/personas",
      icon: IconBrain,
      color: "text-paracosm-orange",
    },
    {
      title: "Profile",
      description: "Manage your user profile and preferences",
      href: "/settings/profile",
      icon: IconUser,
      color: "text-paracosm-green",
    },
  ];

  return (
    <AppLayout>
      <div className="flex flex-col h-full p-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-gray-400 mt-1">
            Configure the Paracosm agent platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map((section) => (
            <Card
              key={section.href}
              className="cursor-pointer hover:border-paracosm-green/20 transition-colors"
              onClick={() => router.push(section.href)}
            >
              <div className="flex items-start gap-4">
                <section.icon size={24} className={section.color} />
                <div>
                  <h3 className="text-white font-medium">{section.title}</h3>
                  <p className="text-sm text-gray-400 mt-1">{section.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
