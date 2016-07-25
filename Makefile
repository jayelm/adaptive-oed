cache:
	taskset 0x1 node examples/cache1.js > log1.txt &
	taskset 0x2 node examples/cache2.js > log2.txt &
	taskset 0x4 node examples/cache3.js > log3.txt &
	taskset 0x8 node examples/cache4.js > log4.txt &
	taskset 0x10 node examples/cache5.js > log5.txt &
