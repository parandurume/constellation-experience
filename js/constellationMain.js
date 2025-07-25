// constellationMain.js - 메인 애플리케이션 (수정된 버전)

class ConstellationMain {
    createQuadrantGuide() {
        // 화면 4분할 가이드 오버레이
        const guide = document.createElement('div');
        guide.id = 'quadrant-guide';
        guide.style.position = 'fixed';
        guide.style.top = '0';
        guide.style.left = '0';
        guide.style.width = '100%';
        guide.style.height = '100%';
        guide.style.pointerEvents = 'none';
        guide.style.zIndex = '10';
        
        // 각 사분면 라벨
        const quadrants = [
            { position: 'bottom: 10%; left: 25%;', text: 'SOUTH (남): 여름', color: '#e2a54a' },
            { position: 'bottom: 10%; right: 25%;', text: 'WEST (서): 가을', color: '#4a90e2' },
            { position: 'top: 10%; right: 25%;', text: 'NORTH (북): 겨울', color: '#e24a4a' },
            { position: 'top: 10%; left: 25%;', text: 'EAST (동): 봄', color: '#4ae24a' }
        ];
        
        quadrants.forEach(q => {
            const label = document.createElement('div');
            label.style.cssText = `
                position: absolute;
                ${q.position}
                transform: translate(-50%, -50%);
                color: ${q.color};
                font-size: 14px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                opacity: 0.6;
            `;
            label.textContent = q.text;
            guide.appendChild(label);
        });
        
        // 십자선
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
            position: absolute;
            top: 0;
            left: 50%;
            width: 1px;
            height: 100%;
            background: rgba(255,255,255,0.1);
        `;
        guide.appendChild(crosshair);
        
        const crosshairH = document.createElement('div');
        crosshairH.style.cssText = `
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
            background: rgba(255,255,255,0.1);
        `;
        guide.appendChild(crosshairH);
        
        document.body.appendChild(guide);
    }
}

class ConstellationExperience {
    constructor() {
        // 핵심 Three.js 객체들
        this.scene = null;
        this.camera = null;
        this.renderer = null;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f0f23);
        this.createStarField(this.scene);
        
        // MediaPipe 관련
        this.hands = null;
        this.camera_stream = null;
        
        // 3D 객체들
        this.currentModel = null;
        this.models = {
            center: null,
            east: null,
            west: null,
            north: null,
            south: null,
            // _28 모델 추가
            east_28: null,
            west_28: null,
            north_28: null,
            south_28: null
        };
        this.modelPaths = {
            center: './models/ChonSangYolChaBunYaJiDo_Plat_Center.glb',
            east: './models/ChonSangYolChaBunYaJiDo_Plat_East.glb',
            west: './models/ChonSangYolChaBunYaJiDo_Plat_West.glb',
            north: './models/ChonSangYolChaBunYaJiDo_Plat_North.glb',
            south: './models/ChonSangYolChaBunYaJiDo_Plat_South.glb',
            // _28 모델 추가
            east_28: './models/ChonSangYolChaBunYaJiDo_Plat_East_28.glb',
            west_28: './models/ChonSangYolChaBunYaJiDo_Plat_West_28.glb',
            north_28: './models/ChonSangYolChaBunYaJiDo_Plat_North_28.glb',
            south_28: './models/ChonSangYolChaBunYaJiDo_Plat_South_28.glb'
        };
        this.currentDirection = 'center';
        
        // 손 위치 표시기
        this.handCursors = [null, null];
        
        // 상호작용 상태
        this.handStates = [
            { // 왼손
                isVisible: false,
                landmarks: null,
                isPinching: false,
                pinchStrength: 0,
                smoothedLandmarks: null,
                lastPinchTime: 0,
                position: null
            },
            { // 오른손
                isVisible: false,
                landmarks: null,
                isPinching: false,
                pinchStrength: 0,
                smoothedLandmarks: null,
                lastPinchTime: 0,
                position: null
            }
        ];
        
        // 선택 상태
        this.selectedSeason = null;
        this.selectedConstellation = null;
        this.isExpanded = false;
        
        // 확대 상태 변수 추가
        this.isZoomed = false;
        this.zoomedDirection = null;
        
        // 애니메이션 상태
        this.initialCameraPosition = null;
        this.initialStarMapOpacity = 0.8;
        
        // 핀치 이펙트 관리
        this.pinchEffects = [];
        this.pinchCooldown = 500; // 밀리초

        // 줌 제스처 관련 변수
        this.isTwoHandsFisting = false;  // 양손 주먹 상태
        this.initialFistDistance = null;
        this.currentZoom = 1.0;
        this.minZoom = 0.3;      // 더 많이 축소 가능
        this.maxZoom = 3.0;      // 더 많이 확대 가능
        this.zoomSensitivity = 0.005;  // 감도 조정
        this.zoomVelocity = 0;   // 줌 속도 (부드러운 줌을 위해)
        
        // V 제스처 감지 변수
        this.vGestureDetected = false;
        this.vGestureCooldown = 1000; // 1초 쿨다운
        this.lastVGestureTime = 0;

        // _28 모델들의 개별 위치 설정
        this.zoomedModelPositions = {
            east_28: { x: 0, y: 0, z: 0 },
            west_28: { x: 0, y: 0, z: 0 },    
            north_28: { x: 0, y: 0, z: 0 },   
            south_28: { x: 0, y: 0, z: 0 }    
        };
        
        // _28 모델 선택 시 카메라가 이동할 위치 (Z값은 고정, XY만 이동)
        this.zoomedCameraPositions = {
            east_28: { 
                position: { x: -0.5, y: 0.7, z: 1.5 },    // 동쪽: 오른쪽으로 이동
                lookAt: { x: 0.5, y: 0, z: 0 }         // 같은 X좌표를 바라봄
            },
            west_28: { 
                position: { x: 0.5, y: -0.7, z: 1.5 },   // 서쪽: 왼쪽으로 이동
                lookAt: { x: -0.5, y: 0, z: 0 }
            },
            north_28: { 
                position: { x: 0.5, y: 0.7, z: 1.5 },    // 북쪽: 위쪽으로 이동
                lookAt: { x: 0, y: 0.5, z: 0 }
            },
            south_28: { 
                position: { x: -0.5, y: -0.7, z: 1.5 },   // 남쪽: 아래쪽으로 이동
                lookAt: { x: 0, y: -0.5, z: 0 }
            }
        };

        // 패닝 관련 변수들 (개선된 버전)
        this.isPanning = false;
        this.panningHandIndex = -1;
        this.panStartPosition = null;  // 패닝 시작 시 손 위치
        this.cameraStartPosition = null;  // 패닝 시작 시 카메라 위치
        this.panOffset = { x: 0, y: 0 };  // 누적 패닝 오프셋
        this.maxPanRange = 3.0;  // XY 평면에서 최대 패닝 거리
        this.panSensitivity = 2.0;  // 패닝 감도
    }

    async init() {
        try {
            const intro = document.getElementById('intro-screen');
            gsap.to(intro, {
                opacity: 0,
                duration: 1,
                delay: 1,
                onComplete: () => intro.remove()
            });

            document.getElementById('status').textContent = 'Three.js 초기화 중...';
            this.setupThreeJS();
            
            document.getElementById('status').textContent = '3D 객체 생성 중...';
            await this.loadAllModels();
            this.createHandCursors();
            this.createQuadrantGuide();
            
            document.getElementById('status').textContent = '카메라 설정 중...';
            await this.setupCamera();
            
            document.getElementById('status').textContent = 'MediaPipe 초기화 중...';
            await this.setupMediaPipe();
            
            this.setupEventListeners();
            this.animate();
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('status').textContent = '준비 완료! 손을 카메라 앞에 위치시키세요.';
            
        } catch (error) {
            console.error('초기화 실패:', error);
            document.getElementById('status').textContent = '초기화 실패: ' + error.message;
        }
    }

    // 클래스 내부 어디든 (init() 밖에서) 선언
    createStarField(scene) {
        const starCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];

        for (let i = 0; i < starCount; i++) {
            const x = THREE.MathUtils.randFloatSpread(400);
            const y = THREE.MathUtils.randFloatSpread(400);
            const z = THREE.MathUtils.randFloatSpread(400);
            positions.push(x, y, z);

            const color = new THREE.Color();
            color.setHSL(0.6 + Math.random() * 0.1, 0.6, 0.8 + Math.random() * 0.2);
            colors.push(color.r, color.g, color.b);
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 1.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        const stars = new THREE.Points(geometry, material);
        scene.add(stars);

        gsap.to(material, {
            opacity: 0.4,
            duration: 2,
            repeat: -1,
            yoyo: true,
            ease: 'sine.inOut'
        });
    }

    setupThreeJS() {
        this.scene = new THREE.Scene();
    
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 0, 1.5);
        this.camera.lookAt(0, 0, 0);  // 항상 Z=0 평면을 바라봄
        this.initialCameraPosition = this.camera.position.clone();
        this.initialCameraRotation = this.camera.rotation.clone();  // 초기 회전값 저장
            
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000011);
        document.getElementById('container').appendChild(this.renderer.domElement);
        
        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(1, 1, 0.5);
        this.scene.add(directionalLight);
        
        window.addEventListener('resize', () => this.onWindowResize());
    }

    async loadAllModels() {
        const loader = new THREE.GLTFLoader();
        
        // 모든 모델 로드
        for (const [direction, path] of Object.entries(this.modelPaths)) {
            try {
                const gltf = await new Promise((resolve, reject) => {
                    loader.load(
                        path,
                        (gltf) => resolve(gltf),
                        (progressEvent) => {
                            const percent = (progressEvent.loaded / progressEvent.total * 100).toFixed(0);
                            const bar = document.getElementById('loading-bar');
                            if (bar) {
                                bar.style.width = `${percent}%`;
                            }
                            console.log(`Loading ${direction}: ${percent}%`);
                        },
                        (error) => reject(error)
                    );
                });
                
                this.models[direction] = gltf.scene;
                
                // _28 모델은 더 큰 스케일로 설정
                if (direction.includes('_28')) {
                    this.models[direction].scale.set(1.5, 1.5, 1.5); // 1.5배 크기
                } else {
                    this.models[direction].scale.set(1, 1, 1);
                }
                
                this.models[direction].position.set(0, 0, 0);
                
                // 🔄 모든 모델을 Z축 기준으로 180도 회전
                this.models[direction].rotation.z = Math.PI; // 180도 = π 라디안
                
                // 재질 설정
                this.models[direction].traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        
                        if (child.material) {
                            // 기존 재질 유지하면서 필요한 속성만 추가
                            child.material.metalness = 0.3;
                            child.material.roughness = 0.7;
                        }
                    }
                });
                
                // 초기에는 center만 보이게
                if (direction === 'center') {
                    this.scene.add(this.models[direction]);
                    this.currentModel = this.models[direction];
                }
                
                console.log(`${direction} 모델 로드 완료 (Z축 180도 회전)`);
            } catch (error) {
                console.error(`${direction} 모델 로드 실패:`, error);
                this.createFallbackModel(direction);
            }
        }
        
        // 모델이 하나도 로드되지 않았다면 폴백 생성
        if (!this.currentModel) {
            console.log('모든 모델 로드 실패, 폴백 모델 생성');
            this.createFallbackModel('center');
        }
    }

    createFallbackModel(direction) {
        // 로드 실패 시 폴백 모델
        const geometry = new THREE.BoxGeometry(2, 2, 2);
        const material = new THREE.MeshBasicMaterial({ 
            color: {
                center: 0x808080,
                east: 0xff0000,
                west: 0x0000ff,
                north: 0x00ff00,
                south: 0xffff00,
                east_28: 0xff6666,
                west_28: 0x6666ff,
                north_28: 0x66ff66,
                south_28: 0xffff66
            }[direction]
        });
        
        this.models[direction] = new THREE.Mesh(geometry, material);
        
        // _28 모델은 더 큰 크기
        if (direction.includes('_28')) {
            this.models[direction].scale.set(3, 3, 3);
        }
        
        // 🔄 폴백 모델도 Z축 기준으로 180도 회전
        this.models[direction].rotation.z = Math.PI;
        
        if (direction === 'center') {
            this.scene.add(this.models[direction]);
            this.currentModel = this.models[direction];
        }
    }

    switchModel(newDirection) {
        // center에서 center를 선택하면 무시
        if (newDirection === 'center' && this.currentDirection === 'center') return;
        
        // 같은 방향이고 확대되지 않은 상태면 무시
        if (this.currentDirection === newDirection && !this.isZoomed) return;
        
        // 현재 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // 확대 상태 초기화
        if (this.isZoomed) {
            this.isZoomed = false;
            this.zoomedDirection = null;
            this.currentZoom = 1.0;
            this.showZoomIndicator(false);
            
            // 카메라와 FOV 원래 위치로 복원
            gsap.to(this.camera.position, {
                x: this.initialCameraPosition.x,
                y: this.initialCameraPosition.y,
                z: this.initialCameraPosition.z,
                duration: 1,
                ease: "power2.out"
            });
            
            gsap.to(this.camera, {
                fov: 75,
                duration: 1,
                ease: "power2.out",
                onUpdate: () => {
                    this.camera.updateProjectionMatrix();
                }
            });
        }
        
        // 새 모델 추가
        if (this.models[newDirection]) {
            this.scene.add(this.models[newDirection]);
            this.currentModel = this.models[newDirection];
            this.currentDirection = newDirection;
            
            console.log(`모델 전환: ${newDirection}`);
            
            if (newDirection === 'center') {
                document.getElementById('status').textContent = '준비 완료! 손을 카메라 앞에 위치시키세요.';
            } else {
                document.getElementById('status').textContent = `${newDirection.toUpperCase()} 모델 (다시 핀치: 확대 모드)`;
            }
        }
    }

    switchToZoomedModel(direction) {
        if (direction === 'center') return;
        
        const zoomedModelKey = `${direction}_28`;
        
        // 현재 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // _28 모델이 있는지 확인
        if (this.models[zoomedModelKey]) {
            this.scene.add(this.models[zoomedModelKey]);
            this.currentModel = this.models[zoomedModelKey];
            this.currentDirection = direction;
            this.isZoomed = true;
            this.zoomedDirection = direction;
            
            // _28 모델로 전환 시 줌 레벨 초기화
            this.currentZoom = 1.0;
            
            // 현재 카메라 상태 저장
            this.preZoomCameraPosition = this.camera.position.clone();
            
            // 방향별 카메라 설정 가져오기
            const cameraConfig = this.zoomedCameraPositions[zoomedModelKey];
            
            if (cameraConfig) {
                // 카메라 위치 이동
                gsap.to(this.camera.position, {
                    x: cameraConfig.position.x,
                    y: cameraConfig.position.y,
                    z: cameraConfig.position.z || 1.5,
                    duration: 1.5,
                    ease: "power2.out"
                });
            }
            
            console.log(`${direction} 구역 확대 모델로 전환`);
            document.getElementById('status').textContent = `${direction.toUpperCase()} 구역 확대 보기 (양손 주먹: 줌, V: 돌아가기)`;
        } else {
            console.warn(`${zoomedModelKey} 모델을 찾을 수 없습니다.`);
        }

        const originalSwitchToZoomedModel = ConstellationExperience.prototype.switchToZoomedModel;
        ConstellationExperience.prototype.switchToZoomedModel = function(direction) {
            // 기존 로직 실행
            originalSwitchToZoomedModel.call(this, direction);
            
            // _28 모델 상세 설명 표시
            this.show28ModelDescription(direction);
            
            console.log(`${direction} _28 모델로 전환 및 상세 설명 표시`);
        };
    }

    createHandCursors() {
        // 왼손 커서 (파란색)
        const leftCursorGeometry = new THREE.RingGeometry(0.05, 0.08, 32);
        const leftCursorMaterial = new THREE.MeshBasicMaterial({
            color: 0x00aaff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.handCursors[0] = new THREE.Mesh(leftCursorGeometry, leftCursorMaterial);
        this.handCursors[0].visible = false;
        this.scene.add(this.handCursors[0]);
        
        // 오른손 커서 (빨간색)
        const rightCursorGeometry = new THREE.RingGeometry(0.05, 0.08, 32);
        const rightCursorMaterial = new THREE.MeshBasicMaterial({
            color: 0xff4444,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        this.handCursors[1] = new THREE.Mesh(rightCursorGeometry, rightCursorMaterial);
        this.handCursors[1].visible = false;
        this.scene.add(this.handCursors[1]);
    }

    updateHandCursor(handIndex, position, isPinching) {
        const cursor = this.handCursors[handIndex];
        if (!cursor) return;
        
        if (isPinching) {
            // 핀치 중에는 커서 숨기기
            cursor.visible = false;
        } else if (position) {
            // 손이 펼쳐진 상태에서는 커서 표시
            cursor.visible = true;
            cursor.position.copy(position);
            
            // 카메라를 향하도록 회전
            cursor.lookAt(this.camera.position);
            
            // 부드러운 펄스 효과
            const scale = 1 + Math.sin(Date.now() * 0.003) * 0.1;
            cursor.scale.set(scale, scale, 1);
        } else {
            cursor.visible = false;
        }
    }

    determineQuadrant(normalizedX, normalizedY) {
        // 화면을 4등분하여 방향 결정
        const isLeft = normalizedX < 0.5;
        const isTop = normalizedY < 0.5;
        
        if (isLeft && isTop) return 'east';      // 좌상단
        else if (!isLeft && isTop) return 'north'; // 우상단
        else if (isLeft && !isTop) return 'south'; // 좌하단
        else if (!isLeft && !isTop) return 'west'; // 우하단
        
        return 'center';
    }

    async setupCamera() {
        const video = document.getElementById('video');
        
        try {
            this.camera_stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: 640, 
                    height: 480,
                    facingMode: 'user'
                }
            });
            video.srcObject = this.camera_stream;
        } catch (error) {
            console.error('카메라 접근 실패:', error);
            throw error;
        }
    }

    async setupMediaPipe() {
        if (typeof Hands === 'undefined') {
            throw new Error('MediaPipe Hands 라이브러리가 로드되지 않았습니다.');
        }

        this.hands = new Hands({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });

        this.hands.setOptions({
            selfieMode: true,
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.5,  // 더 낮은 값으로 조정
            minTrackingConfidence: 0.5    // 더 낮은 값으로 조정
        });

        this.hands.onResults((results) => this.onHandResults(results));

        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera 유틸리티가 로드되지 않았습니다.');
        }

        const camera = new Camera(document.getElementById('video'), {
            onFrame: async () => {
                await this.hands.send({ image: document.getElementById('video') });
            },
            width: 640,
            height: 480
        });

        camera.start();
    }

    onHandResults(results) {
        // 손 추적 상태 초기화
        this.handStates[0].isVisible = false;
        this.handStates[1].isVisible = false;

        if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
            document.getElementById('status').textContent = '손을 카메라 앞에 위치시키세요';
            this.isTwoHandsPinching = false;
            return;
        }

        let statusText = '';
        
        // 양손이 모두 감지되었는지 확인
        const bothHandsDetected = results.multiHandLandmarks.length === 2;
        
        // 감지된 각 손 처리
        for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            const handedness = results.multiHandedness[i];
            const label = handedness.label;
            const score = handedness.score;
            
            // 손 인덱스 결정 (Left = 0, Right = 1)
            const handIndex = label === "Left" ? 0 : 1;
            
            if (score > 0.8) {
                this.updateHandTracking(handIndex, landmarks, label);
                
                const pinchStatus = this.handStates[handIndex].isPinching ? '✊' : '✋';
                statusText += `${label} 손 ${pinchStatus} `;
            }
        }
        
        // 양손 줌 제스처 처리 (_28 모델이 활성화된 경우에만)
        if (bothHandsDetected && this.isZoomed) {
            this.handleTwoHandsZoom();
        } else {
            this.isTwoHandsPinching = false;
            this.initialPinchDistance = null;
        }
        
        // V 제스처 감지 (_28 모델이 활성화된 경우에만)
        if (this.isZoomed) {
            this.detectVGesture();
        }
        
        document.getElementById('status').textContent = statusText || '손을 카메라 앞에 위치시키세요';
    }

    handleTwoHandsZoom() {
        const leftHand = this.handStates[0];
        const rightHand = this.handStates[1];
        
        // 양손이 모두 주먹을 쥐고 있는지 확인
        if (leftHand.isVisible && rightHand.isVisible) {
            const leftFist = this.isFistGesture(leftHand.smoothedLandmarks);
            const rightFist = this.isFistGesture(rightHand.smoothedLandmarks);
            
            if (leftFist && rightFist) {
                // 양손 주먹 사이의 거리 계산
                const distance = this.calculateHandsDistance(
                    leftHand.position,
                    rightHand.position
                );
                
                if (!this.isTwoHandsFisting) {
                    // 줌 제스처 시작
                    this.isTwoHandsFisting = true;
                    this.initialFistDistance = distance;
                    console.log('양손 주먹 줌 제스처 시작');
                    this.showZoomIndicator(true);
                } else {
                    // 거리 변화를 기반으로 줌 레벨 업데이트
                    const distanceRatio = distance / this.initialFistDistance;
                    
                    // 부드러운 줌을 위해 현재 줌에서 점진적으로 변화
                    const targetZoom = this.currentZoom * distanceRatio;
                    this.currentZoom = Math.max(this.minZoom, Math.min(this.maxZoom, targetZoom));
                    
                    // 다음 제스처를 위해 현재 거리를 초기 거리로 업데이트
                    this.initialFistDistance = distance;
                    
                    // 카메라 줌 적용
                    this.applyZoom();
                    
                    // 줌 레벨 표시 업데이트
                    this.updateZoomIndicator();
                }
            } else {
                // 주먹 제스처 종료
                if (this.isTwoHandsFisting) {
                    console.log('양손 주먹 줌 제스처 종료');
                    console.log('최종 줌 레벨:', this.currentZoom);
                    this.showZoomIndicator(false);
                }
                this.isTwoHandsFisting = false;
                this.initialFistDistance = null;
            }
        } else {
            this.isTwoHandsFisting = false;
            this.initialFistDistance = null;
            this.showZoomIndicator(false);
        }
    }

    showZoomIndicator(show) {
        const indicator = document.getElementById('zoom-indicator');
        
        if (show && !indicator) {
            const div = document.createElement('div');
            div.id = 'zoom-indicator';
            div.style.cssText = `
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 10px 20px;
                border-radius: 20px;
                font-size: 18px;
                font-weight: bold;
                z-index: 1000;
                pointer-events: none;
                border: 2px solid rgba(255, 255, 255, 0.3);
            `;
            document.body.appendChild(div);
            
            // 양손 주먹 아이콘도 표시
            const fistIcon = document.createElement('div');
            fistIcon.id = 'fist-icon';
            fistIcon.innerHTML = '👊 ↔️ 👊';
            fistIcon.style.cssText = `
                position: fixed;
                top: 25%;
                left: 50%;
                transform: translateX(-50%);
                font-size: 30px;
                z-index: 1000;
                pointer-events: none;
            `;
            document.body.appendChild(fistIcon);
            
        } else if (!show) {
            if (indicator) indicator.remove();
            const fistIcon = document.getElementById('fist-icon');
            if (fistIcon) fistIcon.remove();
        }
    }

    updateZoomIndicator() {
        const indicator = document.getElementById('zoom-indicator');
        if (indicator) {
            const zoomPercent = Math.round(this.currentZoom * 100);
            indicator.textContent = `줌: ${zoomPercent}%`;
            
            // 줌 레벨에 따라 색상 변경
            if (this.currentZoom > 1.5) {
                indicator.style.borderColor = '#4ae24a'; // 초록색 (확대)
            } else if (this.currentZoom < 0.7) {
                indicator.style.borderColor = '#e24a4a'; // 빨간색 (축소)
            } else {
                indicator.style.borderColor = 'rgba(255, 255, 255, 0.3)'; // 기본
            }
        }
    }

    isFistGesture(landmarks) {
        if (!landmarks) return false;
        
        // 손가락 끝과 손바닥 기준점 사이의 거리 계산
        const palmBase = landmarks[0];  // 손목
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const middleTip = landmarks[12];
        const ringTip = landmarks[16];
        const pinkyTip = landmarks[20];
        
        // 각 손가락이 손바닥에 가까이 있는지 확인
        const threshold = 0.15;  // 거리 임계값
        
        const thumbFolded = this.calculateLandmarkDistance(thumbTip, palmBase) < threshold;
        const indexFolded = this.calculateLandmarkDistance(indexTip, palmBase) < threshold;
        const middleFolded = this.calculateLandmarkDistance(middleTip, palmBase) < threshold;
        const ringFolded = this.calculateLandmarkDistance(ringTip, palmBase) < threshold;
        const pinkyFolded = this.calculateLandmarkDistance(pinkyTip, palmBase) < threshold;
        
        // 모든 손가락이 접혀있으면 주먹
        return indexFolded && middleFolded && ringFolded && pinkyFolded;
    }

    calculateLandmarkDistance(landmark1, landmark2) {
        const dx = landmark1.x - landmark2.x;
        const dy = landmark1.y - landmark2.y;
        const dz = landmark1.z - landmark2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    detectVGesture() {
        let vGestureCount = 0;
        
        // 각 손에서 V 제스처 확인
        for (let handIndex = 0; handIndex < 2; handIndex++) {
            const handState = this.handStates[handIndex];
            
            if (handState.isVisible && handState.smoothedLandmarks) {
                if (this.isVGesture(handState.smoothedLandmarks)) {
                    vGestureCount++;
                }
            }
        }
        
        // 적어도 한 손이 V 제스처를 하고 있는지 확인
        if (vGestureCount > 0 && !this.vGestureDetected) {
            const currentTime = Date.now();
            
            // 쿨다운 체크
            if (currentTime - this.lastVGestureTime > this.vGestureCooldown) {
                this.vGestureDetected = true;
                this.lastVGestureTime = currentTime;
                console.log('V 제스처 감지!');
                
                if (this.isZoomed) {
                    // _28 모델에서 원래 모델로 복귀
                    this.returnToOriginalModel(this.currentDirection);
                }
                
                // 시각적 피드백
                this.createVGestureEffect();
            }
        } else if (vGestureCount === 0) {
            this.vGestureDetected = false;
        }
    }

    updateHandTracking(handIndex, landmarks, handLabel) {
        const handState = this.handStates[handIndex];
        
        // 손 상태 업데이트
        handState.isVisible = true;
        handState.landmarks = landmarks;
        
        // 손떨림 보정을 위한 스무딩 적용
        const smoothedLandmarks = this.smoothLandmarks(handIndex, landmarks);
        
        // 핀치하는 손가락 위치로 변경
        const thumbTip = smoothedLandmarks[4];
        const indexTip = smoothedLandmarks[8];
        const pinchCenter = {
            x: (thumbTip.x + indexTip.x) / 2,
            y: (thumbTip.y + indexTip.y) / 2,
            z: (thumbTip.z + indexTip.z) / 2
        };
        handState.position = this.convertToWorldPosition(pinchCenter, handIndex);
        
        // 제스처 분석
        const gestureInfo = this.analyzeGestures(handIndex, smoothedLandmarks);
        
        // 패닝 중이면 업데이트 (_28 모델에서만)
        if (this.isPanning && this.isZoomed && gestureInfo.isPinching) {
            this.updatePanning(handIndex, gestureInfo);
        }
        
        // 핀치 상태 변화 감지
        if (gestureInfo.isPinching && !handState.isPinching) {
            // 쿨다운 체크
            const currentTime = Date.now();
            if (currentTime - handState.lastPinchTime > this.pinchCooldown) {
                this.onPinchStart(handIndex, gestureInfo, smoothedLandmarks);
                handState.lastPinchTime = currentTime;
            }
        } else if (!gestureInfo.isPinching && handState.isPinching) {
            this.onPinchEnd(handIndex);
        }
        
        // 연속적인 핀치 이펙트 (_28 모델이 아닐 때만)
        if (gestureInfo.isPinching && !this.isZoomed) {
            this.updateContinuousPinchEffect(handIndex, gestureInfo, smoothedLandmarks);
        }
        
        // 손 커서 업데이트
        this.updateHandCursor(handIndex, handState.position, gestureInfo.isPinching);
        
        handState.isPinching = gestureInfo.isPinching;
        handState.pinchStrength = gestureInfo.pinchStrength;
    }

    updatePanning(handIndex, gestureInfo) {
        // 패닝 조건 확인
        if (!this.isPanning || 
            this.panningHandIndex !== handIndex || 
            !this.panStartPosition || 
            !this.cameraStartPosition) {
            return;
        }
        
        // 현재 핀치 위치
        const currentPosition = {
            x: gestureInfo.pinchPosition.x,
            y: gestureInfo.pinchPosition.y
        };
        
        // 정규화된 좌표에서의 이동량 계산 (0~1 범위)
        const normalizedDeltaX = currentPosition.x - this.panStartPosition.x;
        const normalizedDeltaY = currentPosition.y - this.panStartPosition.y;
        
        // 줌 레벨을 고려한 실제 이동량 계산
        const zoomAdjustedSensitivity = this.panSensitivity / this.currentZoom;
        
        // 카메라 이동량 계산 (XY 평면만)
        const cameraDeltaX = -normalizedDeltaX * zoomAdjustedSensitivity * 5.0;  // 좌우 반전
        const cameraDeltaY = normalizedDeltaY * zoomAdjustedSensitivity * 5.0;   // 상하는 그대로
        
        // 새로운 카메라 위치 계산
        let newCameraX = this.cameraStartPosition.x + cameraDeltaX;
        let newCameraY = this.cameraStartPosition.y + cameraDeltaY;
        
        // 패닝 범위 제한
        newCameraX = Math.max(-this.maxPanRange, Math.min(this.maxPanRange, newCameraX));
        newCameraY = Math.max(-this.maxPanRange, Math.min(this.maxPanRange, newCameraY));
        
        // 카메라 위치 업데이트 (Z축은 유지)
        this.camera.position.x = newCameraX;
        this.camera.position.y = newCameraY;
        
        // 누적 오프셋 업데이트
        this.panOffset.x = newCameraX - (this.zoomedCameraPositions[`${this.currentDirection}_28`]?.position.x || 0);
        this.panOffset.y = newCameraY - (this.zoomedCameraPositions[`${this.currentDirection}_28`]?.position.y || 0);
    }

    smoothLandmarks(handIndex, landmarks) {
        const handState = this.handStates[handIndex];
        const smoothingFactor = 0.2; // 더 강한 스무딩
        
        if (!handState.smoothedLandmarks) {
            handState.smoothedLandmarks = landmarks.map(lm => ({...lm}));
            return handState.smoothedLandmarks;
        }
        
        const smoothed = landmarks.map((landmark, i) => {
            const prev = handState.smoothedLandmarks[i];
            return {
                x: prev.x + (landmark.x - prev.x) * smoothingFactor,
                y: prev.y + (landmark.y - prev.y) * smoothingFactor,
                z: prev.z + (landmark.z - prev.z) * smoothingFactor,
                visibility: landmark.visibility
            };
        });
        
        handState.smoothedLandmarks = smoothed;
        return smoothed;
    }

    analyzeGestures(handIndex, landmarks) {
        const gestureInfo = {
            isPinching: false,
            pinchStrength: 0,
            pinchPosition: null
        };
        
        // 엄지와 검지 끝 위치
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        
        // 핀치 거리 계산 (화면 좌표 기준)
        const screenDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
        );
        
        // Z축 거리도 고려
        const depthDistance = Math.abs(thumbTip.z - indexTip.z);
        
        // 전체 거리 (화면 거리를 더 중요하게)
        const totalDistance = screenDistance + depthDistance * 0.5;
        
        // 핀치 강도 계산 (임계값 조정)
        const maxDistance = 0.08; // 더 큰 임계값
        gestureInfo.pinchStrength = Math.max(0, 1 - (totalDistance / maxDistance));
        gestureInfo.isPinching = gestureInfo.pinchStrength > 0.5; // 낮은 임계값
        
        // 핀치 위치 계산 (엄지와 검지 중간점)
        gestureInfo.pinchPosition = {
            x: (thumbTip.x + indexTip.x) / 2,
            y: (thumbTip.y + indexTip.y) / 2,
            z: (thumbTip.z + indexTip.z) / 2
        };
        
        return gestureInfo;
    }

    isVGesture(landmarks) {
        // 손가락 끝 위치
        const thumbTip = landmarks[4];      // 엄지
        const indexTip = landmarks[8];      // 검지
        const middleTip = landmarks[12];    // 중지
        const ringTip = landmarks[16];      // 약지
        const pinkyTip = landmarks[20];     // 소지
        
        // 손가락 MCP 관절 위치 (손바닥 기준)
        const indexMCP = landmarks[5];
        const middleMCP = landmarks[9];
        const ringMCP = landmarks[13];
        const pinkyMCP = landmarks[17];
        
        // 검지와 중지가 펴져 있는지 확인 (y값이 MCP보다 작으면 위로 펴진 것)
        const indexExtended = indexTip.y < indexMCP.y - 0.1;
        const middleExtended = middleTip.y < middleMCP.y - 0.1;
        
        // 약지와 소지가 접혀 있는지 확인
        const ringFolded = ringTip.y > ringMCP.y - 0.05;
        const pinkyFolded = pinkyTip.y > pinkyMCP.y - 0.05;
        
        // V 제스처: 검지와 중지만 펴고 나머지는 접힌 상태
        return indexExtended && middleExtended && ringFolded && pinkyFolded;
    }

    // 두 손 사이의 거리 계산
    calculateHandsDistance(pos1, pos2) {
        if (!pos1 || !pos2) return 0;
        
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    // 줌 적용
    applyZoom() {
        if (!this.isZoomed) return;
        
        // 현재 카메라 설정 가져오기
        const cameraConfig = this.zoomedCameraPositions[`${this.currentDirection}_28`];
        
        if (cameraConfig) {
            // 줌 레벨에 따라 카메라 Z 위치 조정
            const baseZ = cameraConfig.position.z || 1.5;
            const newZ = baseZ / this.currentZoom; // 줌인하면 가까이, 줌아웃하면 멀리
            
            // 부드러운 전환을 위해 GSAP 사용
            gsap.to(this.camera.position, {
                z: newZ,
                duration: 0.1,
                ease: "power2.out"
            });
            
            // FOV 조정으로 추가적인 줌 효과 (선택사항)
            const baseFOV = 75;
            const newFOV = baseFOV / Math.sqrt(this.currentZoom); // 줌인하면 FOV 감소
            
            gsap.to(this.camera, {
                fov: Math.max(20, Math.min(120, newFOV)),
                duration: 0.1,
                ease: "power2.out",
                onUpdate: () => {
                    this.camera.updateProjectionMatrix();
                }
            });
        }
    }

    // V 제스처 이펙트
    createVGestureEffect() {
        // 화면 중앙에 V 아이콘과 메시지 표시
        const vEffect = document.createElement('div');
        vEffect.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 10000;
            pointer-events: none;
        `;
        
        vEffect.innerHTML = `
            <div style="font-size: 100px; transform: scale(0);" id="v-icon">✌️</div>
            <div style="color: white; font-size: 24px; margin-top: 20px; opacity: 0;" id="v-text">
                기본 보기로 돌아갑니다
            </div>
        `;
        
        document.body.appendChild(vEffect);
        
        // 애니메이션
        gsap.timeline()
            .to('#v-icon', {
                scale: 1.5,
                duration: 0.3,
                ease: "back.out(1.7)"
            })
            .to('#v-text', {
                opacity: 1,
                duration: 0.2
            }, "-=0.1")
            .to(vEffect, {
                opacity: 0,
                duration: 0.5,
                delay: 0.8,
                onComplete: () => {
                    document.body.removeChild(vEffect);
                }
            });
        
        // 사운드 효과
        this.playGestureSound(800, 0.1);
    }

    // MediaPipe 좌표를 3D 월드 좌표로 변환
    convertToWorldPosition(normalizedCoord, handIndex) {
        // 화면 비율을 고려한 변환
        const aspect = window.innerWidth / window.innerHeight;
        
        // 카메라 시야각에 맞춘 좌표 계산
        const fovRad = (this.camera.fov * Math.PI) / 180;
        const distance = 2; // 카메라로부터의 거리
        
        // 화면 좌표를 3D 공간으로 매핑
        const worldX = (normalizedCoord.x - 0.5) * Math.tan(fovRad / 2) * aspect * distance * 2;
        const worldY = -(normalizedCoord.y - 0.5) * Math.tan(fovRad / 2) * distance * 2;
        const worldZ = -distance; // 카메라 앞
        
        // 카메라 위치 기준으로 변환
        const worldPos = new THREE.Vector3(worldX, worldY, worldZ);
        worldPos.add(this.camera.position);
        
        return worldPos;
    }

    onPinchStart(handIndex, gestureInfo, landmarks) {
        const handLabel = handIndex === 0 ? "왼손" : "오른손";
        console.log(`${handLabel} 핀치 시작!`);
        
        // 핀치 시작 이펙트
        this.createPinchStartEffect(handIndex, gestureInfo);
        
        // _28 모델 상태 확인
        if (this.isZoomed) {
            // _28 모델에서는 패닝 시작
            this.startPanning(handIndex, gestureInfo);
            return;  // 다른 동작은 하지 않음
        }
        
        // 일반 모드에서의 핀치 동작
        const quadrant = this.determineQuadrant(
            gestureInfo.pinchPosition.x,
            gestureInfo.pinchPosition.y
        );
        
        if (this.currentDirection === 'center') {
            // 중앙에서 방향 선택
            this.switchModel(quadrant);
        } else if (this.currentDirection === quadrant && !this.isZoomed) {
            // 같은 방향 다시 선택 시 _28 모델로 전환
            this.switchToZoomedModel(quadrant);
        } else {
            // 다른 방향 선택
            this.switchModel(quadrant);
        }
    }

    startPanning(handIndex, gestureInfo) {
        // _28 모델이 활성화되어 있는지 확인
        if (!this.isZoomed) {
            console.log('패닝은 _28 모델에서만 가능합니다.');
            return;
        }
        
        // 이미 패닝 중이면 무시
        if (this.isPanning) {
            return;
        }
        
        this.isPanning = true;
        this.panningHandIndex = handIndex;
        
        // 시작 위치 저장
        this.panStartPosition = {
            x: gestureInfo.pinchPosition.x,
            y: gestureInfo.pinchPosition.y
        };
        
        // 현재 카메라 위치 저장
        this.cameraStartPosition = {
            x: this.camera.position.x,
            y: this.camera.position.y
        };
        
        console.log(`패닝 시작 - Hand ${handIndex}:`, this.panStartPosition);
        this.showPanningIndicator(true);
        this.showMessage('핀치를 유지하고 드래그하여 이동', 1500);
    }

    onPinchEnd(handIndex) {
        const handLabel = handIndex === 0 ? "왼손" : "오른손";
        console.log(`${handLabel} 핀치 종료`);
        
        // 패닝 중이었다면 종료
        if (this.isPanning && this.panningHandIndex === handIndex) {
            this.isPanning = false;
            this.panStartPosition = null;
            this.cameraStartPosition = null;
            console.log('패닝 종료');
            
            // 패닝 종료 시각적 효과
            this.showPanningIndicator(false);
        }
    }

    showPanningIndicator(show) {
        const indicatorId = 'panning-indicator';
        let indicator = document.getElementById(indicatorId);
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = indicatorId;
                indicator.style.cssText = `
                    position: fixed;
                    top: 35%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 150, 255, 0.9);
                    color: white;
                    padding: 12px 24px;
                    border-radius: 20px;
                    font-size: 16px;
                    font-weight: bold;
                    z-index: 1000;
                    pointer-events: none;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                `;
                indicator.innerHTML = `
                    <span style="font-size: 24px;">🖐️</span>
                    <span>패닝 모드 - 드래그하여 이동</span>
                `;
                document.body.appendChild(indicator);
                
                // 페이드 인 효과
                gsap.from(indicator, {
                    opacity: 0,
                    y: -20,
                    duration: 0.3,
                    ease: "power2.out"
                });
            }
        } else {
            if (indicator) {
                gsap.to(indicator, {
                    opacity: 0,
                    y: -20,
                    duration: 0.3,
                    ease: "power2.in",
                    onComplete: () => {
                        indicator.remove();
                    }
                });
            }
        }
    }

    returnToOriginalModel(direction) {
        console.log(`${direction} 원래 모델로 복귀`);
        
        // 줌 레벨 완전히 리셋
        this.currentZoom = 1.0;
        this.isTwoHandsFisting = false;
        this.initialFistDistance = null;

        // 패닝 상태 리셋
        this.isPanning = false;
        this.panStartPosition = null;
        this.cameraStartPosition = null;
        
        // 인디케이터 제거
        this.showZoomIndicator(false);
        this.showPanningIndicator(false);
        
        // 현재 확대 모델 제거
        if (this.currentModel) {
            this.scene.remove(this.currentModel);
        }
        
        // 원래 모델 추가
        if (this.models[direction]) {
            this.scene.add(this.models[direction]);
            this.currentModel = this.models[direction];
            this.isZoomed = false;
            this.zoomedDirection = null;
            
            // 카메라를 원래 위치로 완전히 복원 (패닝도 리셋)
            gsap.to(this.camera.position, {
                x: this.initialCameraPosition.x,
                y: this.initialCameraPosition.y,
                z: this.initialCameraPosition.z,
                duration: 1.2,
                ease: "power2.inOut"
            });
            
            // FOV도 원래대로 복원
            gsap.to(this.camera, {
                fov: 75,
                duration: 1.2,
                ease: "power2.inOut",
                onUpdate: () => {
                    this.camera.updateProjectionMatrix();
                }
            });
            
            document.getElementById('status').textContent = `${direction.toUpperCase()} 구역 기본 보기로 복귀`;
        }

        const originalReturnToOriginalModel = ConstellationExperience.prototype.returnToOriginalModel;
        ConstellationExperience.prototype.returnToOriginalModel = function(direction) {
            // 기존 로직 실행
            originalReturnToOriginalModel.call(this, direction);
            
            // 일반 설명으로 복원 및 스타일 복원
            this.showDirectionDescription(direction);
            this.restore28ModelStyle();
            
            console.log(`${direction} 원래 모델로 복귀 및 일반 설명 복원`);
        };

        console.log('_28 모델 상세 설명 시스템 로드 완료');
    }

    showMessage(text, duration = 2000) {
        // 기존 메시지 제거
        const existingMsg = document.getElementById('temp-message');
        if (existingMsg) existingMsg.remove();
        
        const message = document.createElement('div');
        message.id = 'temp-message';
        message.textContent = text;
        message.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 15px 30px;
            border-radius: 25px;
            font-size: 18px;
            z-index: 1000;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        document.body.appendChild(message);
        
        // 페이드 인
        setTimeout(() => {
            message.style.opacity = '1';
        }, 10);
        
        // 페이드 아웃 및 제거
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                message.remove();
            }, 300);
        }, duration);
    }

    createPinchStartEffect(handIndex, gestureInfo) {
        if (!gestureInfo.pinchPosition) {
            console.error('핀치 위치가 없습니다!');
            return;
        }
        
        // 3D 좌표로 변환
        const worldPos = this.convertToWorldPosition(gestureInfo.pinchPosition, handIndex);
        
        // 메인 이펙트 그룹
        const effectGroup = new THREE.Group();
        effectGroup.position.copy(worldPos);
        
        // 작은 중심 글로우 구체
        const glowGeometry = new THREE.SphereGeometry(0.06, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: handIndex === 0 ? 0x00aaff : 0xff4444,
            transparent: true,
            opacity: 1.0
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        effectGroup.add(glowSphere);
        
        // 포인트 라이트
        const pointLight = new THREE.PointLight(
            handIndex === 0 ? 0x00aaff : 0xff4444,
            1,
            2
        );
        effectGroup.add(pointLight);
        
        // 확장 링 이펙트
        this.createExpandingRings(effectGroup, handIndex);
        
        // 파티클 버스트
        this.createParticleBurst(effectGroup, handIndex);
        
        // 씬에 추가
        this.scene.add(effectGroup);
        
        // 이펙트 애니메이션
        this.animatePinchEffect(effectGroup, glowSphere, pointLight);
        
        // 사운드 이펙트
        this.playPinchSound(gestureInfo.pinchStrength);
    }

    createExpandingRings(parentGroup, handIndex) {
        const ringCount = 3;
        const baseColor = handIndex === 0 ? 0x00aaff : 0xff4444;
        
        for (let i = 0; i < ringCount; i++) {
            const ringGeometry = new THREE.RingGeometry(0.02, 0.04, 32);
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: baseColor,
                transparent: true,
                opacity: 1.0 - i * 0.2,
                side: THREE.DoubleSide,
                emissive: baseColor,
                emissiveIntensity: 1
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.lookAt(this.camera.position);
            
            // 시간차 확장 애니메이션
            gsap.to(ring.scale, {
                x: 1 + i * 0.4,
                y: 1 + i * 0.4,
                z: 1,
                duration: 1.0,
                delay: i * 0.1,
                ease: "power2.out"
            });
            
            gsap.to(ring.material, {
                opacity: 0,
                duration: 1.0,
                delay: i * 0.1,
                ease: "power2.out",
                onComplete: () => {
                    parentGroup.remove(ring);
                    ring.geometry.dispose();
                    ring.material.dispose();
                }
            });
            
            parentGroup.add(ring);
        }
    }

    createParticleBurst(parentGroup, handIndex) {
        const particleCount = 30;
        const baseColor = handIndex === 0 ? 0x00aaff : 0xff4444;
        
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.004, 4, 4);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: baseColor,
                transparent: true,
                opacity: 1,
                emissive: baseColor,
                emissiveIntensity: 2
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // 랜덤 방향 벡터
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 0.06 + Math.random() * 0.06;
            
            const velocity = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * speed,
                Math.sin(phi) * Math.sin(theta) * speed,
                Math.cos(phi) * speed
            );
            
            particle.userData = { velocity: velocity };
            parentGroup.add(particle);
            
            // 파티클 애니메이션
            this.animateParticle(particle, parentGroup);
        }
    }

    animateParticle(particle, parentGroup) {
        const animate = () => {
            if (!particle.parent) return;
            
            // 위치 업데이트
            particle.position.add(particle.userData.velocity);
            
            // 중력 효과
            particle.userData.velocity.y -= 0.001;
            
            // 페이드 아웃
            particle.material.opacity -= 0.02;
            
            if (particle.material.opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                parentGroup.remove(particle);
                particle.geometry.dispose();
                particle.material.dispose();
            }
        };
        
        animate();
    }

    animatePinchEffect(effectGroup, glowSphere, pointLight) {
        // 글로우 구체 펄스 애니메이션
        gsap.to(glowSphere.scale, {
            x: 1.4,
            y: 1.4,
            z: 1.4,
            duration: 0.3,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });
        
        // 포인트 라이트 강도 애니메이션
        if (pointLight) {
            gsap.to(pointLight, {
                intensity: 0,
                duration: 1,
                ease: "power2.out"
            });
        }
        
        // 전체 그룹 페이드 아웃
        setTimeout(() => {
            const fadeOut = () => {
                effectGroup.children.forEach(child => {
                    if (child.material && child.material.opacity > 0) {
                        child.material.opacity -= 0.05;
                    }
                });
                
                if (effectGroup.children.some(child => child.material && child.material.opacity > 0)) {
                    requestAnimationFrame(fadeOut);
                } else {
                    this.scene.remove(effectGroup);
                    this.cleanupGroup(effectGroup);
                }
            };
            
            fadeOut();
        }, 1000);
    }

    updateContinuousPinchEffect(handIndex, gestureInfo, landmarks) {
        if (!gestureInfo.pinchPosition) return;
        
        // 3D 좌표로 변환
        const worldPos = this.convertToWorldPosition(gestureInfo.pinchPosition, handIndex);
        
        // 작은 글로우 효과
        const glowGeometry = new THREE.SphereGeometry(0.02 * gestureInfo.pinchStrength, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: handIndex === 0 ? 0x00aaff : 0xff4444,
            transparent: true,
            opacity: gestureInfo.pinchStrength * 0.5,
            emissive: handIndex === 0 ? 0x00aaff : 0xff4444,
            emissiveIntensity: 1
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(worldPos);
        
        this.scene.add(glow);
        
        // 빠른 페이드 아웃
        setTimeout(() => {
            this.scene.remove(glow);
            glow.geometry.dispose();
            glow.material.dispose();
        }, 100);
    }

    playPinchSound(strength) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 강도에 따른 주파수 변화
            const baseFreq = 600;
            const targetFreq = baseFreq + (strength * 400);
            
            oscillator.frequency.setValueAtTime(targetFreq, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(300, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1 * strength, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.log('오디오 재생 실패:', error);
        }
    }

    playGestureSound(frequency, duration) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + duration);
        } catch (error) {
            console.log('오디오 재생 실패:', error);
        }
    }

    cleanupGroup(group) {
        group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (event) => {
            if (this.isExpanded) {
                this.resetView();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'r' || event.key === 'R') {
                this.resetView();
            }
        });
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        
        // 핀치 상태에 따른 UI 업데이트
        this.updatePinchIndicators();
        
        this.renderer.render(this.scene, this.camera);
    }

    updatePinchIndicators() {
        // 양손의 핀치 상태를 화면에 표시
        const leftIndicator = document.getElementById('left-hand-indicator');
        const rightIndicator = document.getElementById('right-hand-indicator');
        
        if (!leftIndicator || !rightIndicator) {
            // 인디케이터 생성
            this.createHandIndicators();
            return;
        }
        
        // 왼손 상태
        if (this.handStates[0].isVisible) {
            leftIndicator.style.display = 'block';
            leftIndicator.style.opacity = this.handStates[0].isPinching ? '1' : '0.3';
            leftIndicator.style.transform = `scale(${1 + this.handStates[0].pinchStrength * 0.5})`;
        } else {
            leftIndicator.style.display = 'none';
        }
        
        // 오른손 상태
        if (this.handStates[1].isVisible) {
            rightIndicator.style.display = 'block';
            rightIndicator.style.opacity = this.handStates[1].isPinching ? '1' : '0.3';
            rightIndicator.style.transform = `scale(${1 + this.handStates[1].pinchStrength * 0.5})`;
        } else {
            rightIndicator.style.display = 'none';
        }

        // _28 모델 상태 표시
        if (this.isZoomed) {
            const controlsInfo = document.getElementById('controls-info');
            if (!controlsInfo) {
                const info = document.createElement('div');
                info.id = 'controls-info';
                info.style.cssText = `
                    position: fixed;
                    bottom: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.8);
                    color: white;
                    padding: 10px 20px;
                    border-radius: 10px;
                    font-size: 14px;
                    text-align: center;
                    z-index: 100;
                `;
                info.innerHTML = `
                    <div>👆 핀치 드래그: 이동 | 👊 양손 주먹: 줌 | ✌️ V: 돌아가기</div>
                `;
                document.body.appendChild(info);
            }
        } else {
            const controlsInfo = document.getElementById('controls-info');
            if (controlsInfo) controlsInfo.remove();
        }
    }

    createHandIndicators() {
        // 왼손 인디케이터
        const leftIndicator = document.createElement('div');
        leftIndicator.id = 'left-hand-indicator';
        leftIndicator.innerHTML = '✋';
        leftIndicator.style.cssText = `
            position: fixed;
            left: 20px;
            bottom: 20px;
            font-size: 40px;
            color: #00aaff;
            opacity: 0.3;
            transition: all 0.2s ease;
            user-select: none;
            pointer-events: none;
            z-index: 100;
        `;
        
        // 오른손 인디케이터
        const rightIndicator = document.createElement('div');
        rightIndicator.id = 'right-hand-indicator';
        rightIndicator.innerHTML = '✋';
        rightIndicator.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            font-size: 40px;
            color: #ff4444;
            opacity: 0.3;
            transition: all 0.2s ease;
            user-select: none;
            pointer-events: none;
            z-index: 100;
            transform: scaleX(-1);
        `;
        
        document.body.appendChild(leftIndicator);
        document.body.appendChild(rightIndicator);
    }

    resetView() {
        console.log('뷰 리셋 시작');
        
        this.isExpanded = false;
        this.selectedSeason = null;
        this.selectedConstellation = null;
        this.isZoomed = false;
        this.zoomedDirection = null;
        document.getElementById('interaction-mode').textContent = 'waiting';
        document.getElementById('selected-season').textContent = '없음';
        
        // 중앙 모델로 복귀
        this.switchModel('center');
        
        // 카메라를 초기 위치로 완전히 복원
        gsap.to(this.camera.position, {
            x: this.initialCameraPosition.x,
            y: this.initialCameraPosition.y,
            z: this.initialCameraPosition.z,
            duration: 1.5,
            ease: "power2.out"
        });
        
        // 카메라 회전도 초기화
        gsap.to(this.camera.rotation, {
            x: 0,
            y: 0,
            z: 0,
            duration: 1.5,
            ease: "power2.out"
        });
        
        document.getElementById('status').textContent = '리셋 완료! 손을 카메라 앞에 위치시키세요.';
    }

    createQuadrantGuide() {
        // 화면 4분할 가이드 오버레이
        const guide = document.createElement('div');
        guide.id = 'quadrant-guide';
        guide.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 10;
        `;
        
        // 각 사분면 라벨
        const quadrants = [
            { position: 'bottom: 10%; left: 25%;', text: 'SOUTH (남): 여름', color: '#e2a54a' },
            { position: 'bottom: 10%; right: 25%;', text: 'WEST (서): 가을', color: '#4a90e2' },
            { position: 'top: 10%; right: 25%;', text: 'NORTH (북): 겨울', color: '#e24a4a' },
            { position: 'top: 10%; left: 25%;', text: 'EAST (동): 봄', color: '#4ae24a' }
        ];
        
        quadrants.forEach(q => {
            const label = document.createElement('div');
            label.style.cssText = `
                position: absolute;
                ${q.position}
                transform: translate(-50%, -50%);
                color: ${q.color};
                font-size: 14px;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
                opacity: 0.6;
            `;
            label.textContent = q.text;
            guide.appendChild(label);
        });
        
        // 십자선
        const crosshair = document.createElement('div');
        crosshair.style.cssText = `
            position: absolute;
            top: 0;
            left: 50%;
            width: 1px;
            height: 100%;
            background: rgba(255,255,255,0.1);
        `;
        guide.appendChild(crosshair);
        
        const crosshairH = document.createElement('div');
        crosshairH.style.cssText = `
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: 1px;
            background: rgba(255,255,255,0.1);
        `;
        guide.appendChild(crosshairH);
        
        document.body.appendChild(guide);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    // 별자리 설명 메서드들 (간단한 버전)
    showSeasonDescription(season) {
        const seasonDescriptions = {
            spring: {
                title: '동방청룡 (東方靑龍)',
                content: '동쪽을 지키는 푸른 용의 별자리입니다. 봄철 밤하늘에서 관찰할 수 있으며, 각수부터 기수까지 7개의 별자리로 구성됩니다.',
                constellations: ['각수', '항수', '저수', '방수', '심수', '미수', '기수']
            },
            summer: {
                title: '남방주작 (南方朱雀)',
                content: '남쪽을 지키는 붉은 새의 별자리입니다. 여름철 밤하늘에서 관찰할 수 있으며, 정수부터 진수까지 7개의 별자리로 구성됩니다.',
                constellations: ['정수', '귀수', '류수', '성수', '장수', '익수', '진수']
            },
            autumn: {
                title: '서방백호 (西方白虎)',
                content: '서쪽을 지키는 흰 호랑이의 별자리입니다. 가을철 밤하늘에서 관찰할 수 있으며, 규수부터 삼수까지 7개의 별자리로 구성됩니다.',
                constellations: ['규수', '루수', '위수', '묘수', '필수', '자수', '삼수']
            },
            winter: {
                title: '북방현무 (北方玄武)',
                content: '북쪽을 지키는 거북과 뱀의 별자리입니다. 겨울철 밤하늘에서 관찰할 수 있으며, 두수부터 벽수까지 7개의 별자리로 구성됩니다.',
                constellations: ['두수', '우수', '여수', '허수', '위수', '실수', '벽수']
            }
        };
        
        const info = seasonDescriptions[season];
        if (!info) return;
        
        const panel = document.getElementById('description-panel');
        const title = document.getElementById('description-title');
        const content = document.getElementById('description-content');
        const sub = document.getElementById('description-sub');
        
        if (title) title.textContent = info.title;
        if (content) {
            content.innerHTML = `
                ${info.content}<br><br>
                <strong>구성 별자리:</strong><br>
                ${info.constellations.join(' → ')}
            `;
        }
        if (sub) sub.textContent = '각 별자리를 핀치하여 자세한 정보를 확인하세요.';
        
        if (panel) panel.style.opacity = '1';
    }

    resetToDefaultDescription() {
        const panel = document.getElementById('description-panel');
        const title = document.getElementById('description-title');
        const content = document.getElementById('description-content');
        const sub = document.getElementById('description-sub');
        
        if (title) title.textContent = '천상열차분야지도';
        if (content) {
            content.textContent = '조선 초기에 제작된 석각 천문도로, 태조 4년(1395년)에 만들어진 우리나라의 대표적인 천문 유물입니다. 하늘의 별자리를 돌에 새긴 것으로, 당시의 천문학 수준을 보여주는 중요한 문화재입니다.';
        }
        if (sub) sub.textContent = '손을 카메라 앞에 위치시키고 핀치 제스처로 탐험을 시작하세요.';
        
        if (panel) panel.style.opacity = '1';
    }
}

// 🔧 클래스 외부에서 메서드 확장 (올바른 방식)
Object.assign(ConstellationExperience.prototype, {
    
    // 방향 선택 시 계절 설명 표시
    showDirectionDescription(direction) {
        const directionToSeason = {
            east: 'spring',
            south: 'summer',
            west: 'autumn',
            north: 'winter'
        };
        
        const season = directionToSeason[direction];
        if (season) {
            this.showSeasonDescription(season);
            this.selectedSeason = season;
        }
    },
    
    // 기본 설명으로 복원
    resetDescription() {
        this.resetToDefaultDescription();
        this.selectedSeason = null;
    },

    // _28 모델 진입 시 상세 설명 표시
    show28ModelDescription(direction) {
        const descriptions28 = {
            east: {
                title: '동방칠수 상세',
                symbol: '🐉',
                content: `청룡의 형상을 이루는 동방칠수는 봄철의 대표적인 별자리입니다. 각각은 용의 몸, 용의 목, 가슴 등 용의 각 부위를 나타내며 고대 중국인들은 이 용이 동방을 지키며 농사와 생명력을 관장한다고 믿었습니다. 농서 시대를 알리는 중요한 별자리들로 새로운 시작을 상징하는 데 사용되어왔습니다.`,
                detailed: `현재드래그 이동 | 양손 주먹: 확대/축소 | V 제스처: 돌아가기`,
                constellations: [
                    '각수(角宿) - 용의 뿔',
                    '항수(亢宿) - 용의 목',
                    '저수(氐宿) - 용의 가슴',
                    '방수(房宿) - 용의 배',
                    '심수(心宿) - 용의 심장',
                    '미수(尾宿) - 용의 꼬리',
                    '기수(箕宿) - 키(곡식을 까부르는 도구)'
                ]
            },
            
            south: {
                title: '남방칠수 상세',
                symbol: '🔥',
                content: `주작(불새)의 형상을 이루는 남방칠수는 여름의 대표적인 별자리입니다. 주작은 우아하고 우아한 불새의 모습으로 여름의 열정과 성장을 상징합니다. 고대인들은 이 별자리가 남쪽 하늘을 지키며 풍요로운 여름철과 농작물의 성장을 돕는다고 믿었습니다.`,
                detailed: `현재드래그 이동 | 양손 주먹: 확대/축소 | V 제스처: 돌아가기`,
                constellations: [
                    '정수(井宿) - 우물',
                    '귀수(鬼宿) - 귀신',
                    '류수(柳宿) - 버들나무',
                    '성수(星宿) - 별',
                    '장수(張宿) - 활을 당기다',
                    '익수(翼宿) - 날개',
                    '진수(軫宿) - 수레'
                ]
            },
            
            west: {
                title: '서방칠수 상세',
                symbol: '🐅',
                content: `백호의 형상을 이루는 서방칠수는 가을의 대표적인 별자리입니다. 백호는 사납고 강력한 힘을 지닌 흰 호랑이의 모습으로 가을의 엄숙함과 추수를 상징합니다. 고대인들은 서쪽 하늘을 지키며 전쟁과 용맹, 그리고 가을 추수의 결실을 관장한다고 믿었습니다.`,
                detailed: `현재드래그 이동 | 양손 주먹: 확대/축소 | V 제스처: 돌아가기`,
                constellations: [
                    '규수(奎宿) - 다리를 벌리다',
                    '루수(婁宿) - 묶다',
                    '위수(胃宿) - 위',
                    '묘수(昴宿) - 좀생이별(플레이아데스)',
                    '필수(畢宿) - 그물',
                    '자수(觜宿) - 부리',
                    '삼수(參宿) - 참(오리온자리)'
                ]
            },
            
            north: {
                title: '북방칠수 상세',
                symbol: '🐢',
                content: `현무(거북과 뱀)의 형상을 이루는 북방칠수는 겨울의 대표적인 별자리입니다. 현무는 거북과 뱀이 합쳐진 신비로운 동물로 겨울의 정적과 지혜를 상징합니다. 고대인들은 이 별자리가 북쪽 하늘을 지키며 겨울철의 혹독함을 이겨내는 인내와 지혜를 관장한다고 믿었습니다.`,
                detailed: `현재드래그 이동 | 양손 주먹: 확대/축소 | V 제스처: 돌아가기`,
                constellations: [
                    '두수(斗宿) - 북두칠성',
                    '우수(牛宿) - 소(견우)',
                    '여수(女宿) - 여자(직녀)',
                    '허수(虛宿) - 빈 곳',
                    '위수(危宿) - 위험',
                    '실수(室宿) - 방',
                    '벽수(壁宿) - 벽'
                ]
            }
        };
        
        const info = descriptions28[direction];
        if (!info) return;
        
        const panel = document.getElementById('description-panel');
        const title = document.getElementById('description-title');
        const content = document.getElementById('description-content');
        const sub = document.getElementById('description-sub');
        
        if (title) title.textContent = info.title;
        if (content) {
            content.innerHTML = `
                <strong>${info.symbol} ${info.title}</strong><br><br>
                ${info.content}<br><br>
                <strong>구성 별자리 (28수):</strong><br>
                ${info.constellations.map(constellation => `• ${constellation}`).join('<br>')}
            `;
        }
        if (sub) sub.textContent = info.detailed;
        
        if (panel) {
            panel.style.opacity = '1';
            // _28 모델용 특별한 스타일 적용
            panel.style.borderColor = 'rgba(255, 215, 0, 0.6)';
            panel.style.boxShadow = '0 8px 32px rgba(255, 215, 0, 0.3)';
        }
        
        console.log(`${direction} _28 모델 상세 설명 표시`);
    },
    
    // _28 모델에서 나갈 때 스타일 복원
    restore28ModelStyle() {
        const panel = document.getElementById('description-panel');
        if (panel) {
            panel.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            panel.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.6)';
        }
    }
});

// 기존 메서드들을 확장하여 UI 업데이트 추가
const originalSwitchModel = ConstellationExperience.prototype.switchModel;
ConstellationExperience.prototype.switchModel = function(newDirection) {
    // 기존 로직 실행
    originalSwitchModel.call(this, newDirection);
    
    // UI 업데이트 추가
    if (newDirection === 'center') {
        this.resetDescription();
    } else {
        this.showDirectionDescription(newDirection);
    }
};

// resetView 메서드 확장
const originalResetView = ConstellationExperience.prototype.resetView;
ConstellationExperience.prototype.resetView = function() {
    // 기존 로직 실행
    originalResetView.call(this);
    
    // UI 리셋
    this.resetDescription();
};

// 애플리케이션 시작
window.addEventListener('load', () => {
    window.constellationApp = new ConstellationExperience();
    window.constellationApp.init();
    
    console.log('ConstellationMain 통합 패치 적용 완료');
});