"use client";

import { Button } from "@packages/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/components/ui/card";
import { Input } from "@packages/ui/components/ui/input";
import { Label } from "@packages/ui/components/ui/label";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Unplug,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface CredentialStatus {
  configured: boolean;
  provider?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function TradingSettingsPage() {
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/credentials");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = async () => {
    if (!username || !password) {
      setMessage({ type: "error", text: "Vui lòng nhập username và password" });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Đã lưu thông tin DNSE" });
        setUsername("");
        setPassword("");
        fetchStatus();
      } else {
        const data = await res.json();
        setMessage({
          type: "error",
          text: data.error || "Lưu thất bại",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials/test", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Kết nối DNSE thành công!" });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Kết nối thất bại",
        });
      }
    } catch {
      setMessage({ type: "error", text: "Lỗi kết nối" });
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/credentials", {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Đã xóa thông tin DNSE" });
        fetchStatus();
      }
    } catch {
      setMessage({ type: "error", text: "Xóa thất bại" });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>DNSE Trading</CardTitle>
          <CardDescription>
            Kết nối tài khoản DNSE Lightspeed để giao dịch và nhận dữ liệu
            real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status?.configured && (
            <div className="flex items-center gap-2 rounded-md border-3 border-green-600 bg-green-50 px-4 py-3 dark:bg-green-950/30">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-bold text-sm text-green-800 dark:text-green-400">
                  Đã kết nối DNSE
                </p>
                {status.updatedAt && (
                  <p className="text-xs text-green-700 dark:text-green-500">
                    Cập nhật:{" "}
                    {new Date(status.updatedAt).toLocaleDateString("vi-VN")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dnse-username" className="font-bold">
                Username
              </Label>
              <Input
                id="dnse-username"
                placeholder="Nhập username DNSE"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border-3"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dnse-password" className="font-bold">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="dnse-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Nhập password DNSE"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {message && (
            <div
              className={`rounded-md border-3 px-4 py-3 text-sm font-bold ${
                message.type === "success"
                  ? "border-green-600 bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400"
                  : "border-red-600 bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || !username || !password}
              className="border-3 border-black bg-black font-bold text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-black/90 dark:border-white dark:bg-white dark:text-black dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,1)]"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lưu
            </Button>

            {status?.configured && (
              <>
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={testing}
                  className="border-3 font-bold"
                >
                  {testing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unplug className="mr-2 h-4 w-4" />
                  )}
                  Test kết nối
                </Button>

                <Button
                  variant="outline"
                  onClick={handleRemove}
                  disabled={removing}
                  className="border-3 font-bold text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400"
                >
                  {removing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Xóa
                </Button>
              </>
            )}
          </div>

          <div className="border-t-3 pt-4">
            <p className="text-xs text-muted-foreground">
              Thông tin đăng nhập được mã hóa AES-256-GCM trước khi lưu vào
              database. Chỉ dùng để kết nối API giao dịch DNSE.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
