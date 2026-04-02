import React, { useState } from "react";
// Đã bỏ chữ Page ở đây đi
import { Button, useSnackbar, Box, Text } from "zmp-ui";
import { getAccessToken } from "zmp-sdk/apis";

const LoginPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { openSnackbar } = useSnackbar();

  const handleLoginZalo = async () => {
    setIsLoading(true);
    try {
      const accessToken = await getAccessToken({});
      alert("Token nè: " + accessToken);
      console.log("Token Zalo thô móc được nè:", accessToken);

      openSnackbar({
        text: "Lấy Token thành công! Mở Console xem mã.",
        type: "success",
      });

      // TODO: Đợi Giang làm xong API thì gọi fetch ở đây
    } catch (error) {
      console.error("Lỗi lấy token Zalo:", error);
      openSnackbar({
        text: "Lỗi! Không lấy được Token.",
        type: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Đổi thẻ <Page> thành <div> và dùng class Tailwind để căn giữa
    <div className="flex-1 flex justify-center items-center bg-gray-100 w-full h-full">
      <Box className="p-4 bg-white rounded-xl text-center shadow-sm w-11/12 m-auto mt-20">
        <Text.Title className="mb-4">Đăng Nhập</Text.Title>
        <Button
          onClick={handleLoginZalo}
          loading={isLoading}
          fullWidth
          variant="primary"
        >
          Đăng nhập bằng Zalo
        </Button>
      </Box>
    </div>
  );
};

export default LoginPage;
