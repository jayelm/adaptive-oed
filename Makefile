cache:
	taskset 0x1 node --max-old-space-size=4096 examples/cache1.js > log1.txt 2>&1 &
	taskset 0x2 node --max-old-space-size=4096 examples/cache2.js > log2.txt 2>&1 &
	taskset 0x4 node --max-old-space-size=4096 examples/cache3.js > log3.txt 2>&1 &
	taskset 0x8 node --max-old-space-size=4096 examples/cache4.js > log4.txt 2>&1 &
	taskset 0x10 node --max-old-space-size=4096 examples/cache5.js > log5.txt 2>&1 &
