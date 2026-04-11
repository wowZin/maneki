#!/bin/bash
# 本地 LLM 环境检测脚本
# 使用方法: chmod +x test-local-llm.sh && ./test-local-llm.sh

echo "=========================================="
echo "  本地 LLM 部署环境检测"
echo "=========================================="
echo ""

# 检测操作系统
OS="Unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    OS="Windows"
fi
echo "✓ 操作系统: $OS"

# 检测 CPU
echo ""
echo "【CPU 信息】"
if [[ "$OS" == "macOS" ]]; then
    CPU=$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown")
    CORES=$(sysctl -n hw.ncpu 2>/dev/null || echo "Unknown")
    echo "  型号: $CPU"
    echo "  核心数: $CORES"
else
    CPU=$(grep "model name" /proc/cpuinfo | head -1 | cut -d':' -f2 | xargs 2>/dev/null || echo "Unknown")
    CORES=$(nproc 2>/dev/null || echo "Unknown")
    echo "  型号: $CPU"
    echo "  核心数: $CORES"
fi

# 检测内存
echo ""
echo "【内存信息】"
if [[ "$OS" == "macOS" ]]; then
    MEM_GB=$(($(sysctl -n hw.memsize 2>/dev/null || echo 0) / 1024 / 1024 / 1024))
    echo "  总内存: ${MEM_GB}GB"
else
    MEM_GB=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || echo "Unknown")
    echo "  总内存: ${MEM_GB}GB"
fi

# 评估内存是否够用
if [[ "$MEM_GB" != "Unknown" && "$MEM_GB" -lt 16 ]]; then
    echo "  ⚠️ 警告: 内存不足16GB，运行14B模型会很慢"
elif [[ "$MEM_GB" != "Unknown" && "$MEM_GB" -lt 32 ]]; then
    echo "  ✅ 内存16-32GB，可以运行14B模型（CPU模式）"
else
    echo "  ✅ 内存充足，运行14B模型无压力"
fi

# 检测 GPU
echo ""
echo "【GPU 信息】"
GPU_INFO="Unknown"
GPU_VRAM="Unknown"

if [[ "$OS" == "macOS" ]]; then
    # Mac 检测
    if system_profiler SPDisplaysDataType 2>/dev/null | grep -q "Apple M"; then
        CHIP=$(system_profiler SPDisplaysDataType 2>/dev/null | grep "Chipset" | head -1 | sed 's/.*Chipset: //')
        echo "  芯片: Apple Silicon ($CHIP)"
        echo "  ✅ Mac 统一内存架构，内存可直接当显存用"
    else
        GPU=$(system_profiler SPDisplaysDataType 2>/dev/null | grep "Chipset" | head -1 | sed 's/.*Chipset: //')
        echo "  GPU: $GPU"
    fi
else
    # Linux/Windows 检测 NVIDIA
    if command -v nvidia-smi &> /dev/null; then
        GPU_INFO=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
        GPU_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
        echo "  型号: $GPU_INFO"
        if [[ "$GPU_VRAM" != "Unknown" ]]; then
            VRAM_GB=$((GPU_VRAM / 1024))
            echo "  显存: ${VRAM_GB}GB"

            if [[ $VRAM_GB -ge 24 ]]; then
                echo "  ✅ 显存充足，可以流畅运行14B/32B模型"
            elif [[ $VRAM_GB -ge 12 ]]; then
                echo "  ✅ 可以运行14B模型"
            elif [[ $VRAM_GB -ge 8 ]]; then
                echo "  ⚠️ 可以运行7B模型，14B需要量化"
            else
                echo "  ❌ 显存不足，只能用CPU运行（慢）"
            fi
        fi
    else
        echo "  未检测到 NVIDIA GPU"
        echo "  将使用 CPU 运行（速度较慢）"
    fi
fi

# 检测存储
echo ""
echo "【存储空间】"
if [[ "$OS" == "macOS" ]]; then
    DISK_AVAIL=$(df -h / 2>/dev/null | awk 'NR==2 {print $4}')
    echo "  可用空间: $DISK_AVAIL"
else
    DISK_AVAIL=$(df -h / 2>/dev/null | awk 'NR==2 {print $4}')
    echo "  可用空间: $DISK_AVAIL"
fi
echo "  (14B模型需要约8GB下载空间)"

echo ""
echo "=========================================="
echo "  环境评估结果"
echo "=========================================="
echo ""

# 综合评估
CAN_RUN_7B=false
CAN_RUN_14B=false
CAN_RUN_32B=false

if [[ "$MEM_GB" != "Unknown" && "$MEM_GB" -ge 8 ]]; then
    CAN_RUN_7B=true
fi

if [[ "$MEM_GB" != "Unknown" && "$MEM_GB" -ge 16 ]]; then
    CAN_RUN_14B=true
fi

if [[ "$GPU_VRAM" != "Unknown" ]]; then
    VRAM_GB=$((GPU_VRAM / 1024))
    if [[ $VRAM_GB -ge 8 ]]; then
        CAN_RUN_7B=true
    fi
    if [[ $VRAM_GB -ge 16 ]]; then
        CAN_RUN_14B=true
    fi
    if [[ $VRAM_GB -ge 24 ]]; then
        CAN_RUN_32B=true
    fi
fi

echo "✅ 可以运行的模型:"
echo ""
if [[ "$CAN_RUN_32B" == true ]]; then
    echo "  • Qwen2.5-32B (GPU加速，效果接近GPT-4)"
fi
if [[ "$CAN_RUN_14B" == true ]]; then
    echo "  • Qwen2.5-14B (推荐，效果接近GPT-3.5)"
else
    echo "  • Qwen2.5-14B (CPU模式，较慢)"
fi
if [[ "$CAN_RUN_7B" == true ]]; then
    echo "  • Qwen2.5-7B (流畅运行)"
fi

echo ""
echo "【建议】"
if [[ "$CAN_RUN_14B" == true ]]; then
    echo "✅ 你的电脑可以本地部署14B模型进行测试"
    echo "   建议先测试14B效果，如果满意可以省70%成本"
else
    echo "⚠️ 你的电脑配置较低，建议:"
    echo "   1. 先用7B模型测试架构"
    echo "   2. 或者租用阿里云GPU服务器(¥800/月)测试14B"
fi

echo ""
echo "=========================================="
